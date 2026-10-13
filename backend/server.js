import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateAmount } from './src/validateAmount.js';

const app = express();
const port = process.env.PORT || 3001;

// Signeringsnyckeln för JWT måste finnas och vara minst 32 byte.
// Servern avslutas direkt med ett tydligt fel annars, istället för att
// starta med en svag eller saknad nyckel.
const secret = process.env.JWT_SECRET;

if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET måste vara minst 32 byte');
}

const JWT_ISSUER = 'banken';
const JWT_AUDIENCE = 'banken-api';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Datat lagras i en MySQL-databas som körs i en egen container.
// Anslutningsuppgifterna kommer från miljövariabler som docker-compose
// skickar in, med lokala standardvärden så servern även går att köra
// utanför Docker om man har en egen MySQL igång.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bank',
});

// Liten hjälpfunktion så varje route slipper upprepa samma mönster
async function query(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

// Skyddar routes som kräver en inloggad användare. Läser token ur
// Authorization: Bearer <token>, verifierar signatur, utgångstid, issuer
// och audience, och lägger ett kontrollerat användar-id i req.userId.
// Anropar aldrig next() om någon kontroll misslyckas.
function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';

    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Saknar giltig Authorization-header' });
    }

    const token = header.slice('Bearer '.length);

    let payload;
    try {
        payload = jwt.verify(token, secret, {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
    } catch (error) {
        return res.status(401).json({ error: 'Ogiltig eller utgången token' });
    }

    if (typeof payload !== 'object' || payload === null || typeof payload.sub !== 'string') {
        return res.status(401).json({ error: 'Ogiltig eller utgången token' });
    }

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({ error: 'Ogiltig eller utgången token' });
    }

    req.userId = userId;
    next();
}

// Skapar transactions-tabellen om den inte redan finns. database/init.sql
// körs bara av MySQL-containern första gången en ny databasvolym skapas,
// så det här gör samma sak vid varje uppstart för befintliga installationer.
async function ensureSchema() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            accountId INT UNSIGNED NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'deposit',
            amount INT NOT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY transactions_accountId_idx (accountId)
        )
    `);
}

// Skapar en ny användare och ett tillhörande konto med 0 kr i saldo.
// Lösenordet sparas aldrig i klartext, bara dess bcrypt-hash.
app.post('/users', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Användarnamn och lösenord krävs' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Lösenordet måste vara minst 8 tecken' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash],
        );
        const userId = result.insertId;

        await query('INSERT INTO accounts (userId, amount) VALUES (?, 0)', [userId]);

        res.status(201).json({ id: userId, username });
    } catch (error) {
        // ER_DUP_ENTRY slår till om användarnamnet redan finns (UNIQUE i databasen)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Användarnamnet är upptaget' });
        }
        console.error('Fel vid skapande av användare', error);
        res.status(500).json({ error: 'Något gick fel' });
    }
});

// Loggar in användaren: jämför lösenordet mot det sparade hashvärdet och
// skapar en kortlivad JWT istället för den tidigare engångskoden.
app.post('/sessions', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
    }

    const rows = await query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    // Samma felmeddelande oavsett om användarnamnet saknas eller lösenordet
    // är fel, så ett svar aldrig avslöjar vilka användarnamn som finns.
    const passwordIsCorrect = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !passwordIsCorrect) {
        return res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
    }

    const token = jwt.sign({ sub: String(user.id) }, secret, {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '15m',
    });

    res.status(200).json({ token });
});

// Returnerar saldot för kontot som hör till den inloggade användaren
app.post('/me/accounts', requireAuth, async (req, res) => {
    const rows = await query('SELECT amount FROM accounts WHERE userId = ?', [req.userId]);

    if (!rows[0]) {
        return res.status(404).json({ error: 'Kontot kunde inte hittas' });
    }

    res.status(200).json({ amount: rows[0].amount });
});

// Sätter in pengar på kontot, loggar en transaktion och returnerar det nya
// saldot. Saldot och transaktionsraden uppdateras i samma databastransaktion
// så de aldrig kan hamna i otakt med varandra.
app.post('/me/accounts/transactions', requireAuth, async (req, res) => {
    const { amount } = req.body;

    if (!validateAmount(amount)) {
        return res.status(400).json({ error: 'Ogiltigt belopp' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [accountRows] = await connection.execute(
            'SELECT id, amount FROM accounts WHERE userId = ? FOR UPDATE',
            [req.userId],
        );
        const account = accountRows[0];
        const newAmount = account.amount + amount;

        await connection.execute('UPDATE accounts SET amount = ? WHERE id = ?', [newAmount, account.id]);
        await connection.execute(
            'INSERT INTO transactions (accountId, type, amount) VALUES (?, ?, ?)',
            [account.id, 'deposit', amount],
        );

        await connection.commit();
        res.status(200).json({ amount: newAmount });
    } catch (error) {
        await connection.rollback();
        console.error('Fel vid insättning', error);
        res.status(500).json({ error: 'Något gick fel' });
    } finally {
        connection.release();
    }
});

// Hämtar den inloggade användarens egna transaktioner, senaste först.
app.get('/me/accounts/transactions', requireAuth, async (req, res) => {
    const rows = await query(
        `SELECT t.amount, t.type, t.createdAt
         FROM transactions t
         JOIN accounts a ON a.id = t.accountId
         WHERE a.userId = ?
         ORDER BY t.createdAt DESC`,
        [req.userId],
    );

    res.status(200).json({ transactions: rows });
});

// Säkerställ databasschemat, starta sedan servern
ensureSchema()
    .then(() => {
        app.listen(port, () => {
            console.log(`Bankens backend körs på http://localhost:${port}`);
        });
    })
    .catch((error) => {
        console.error('Kunde inte säkerställa databasschema', error);
        process.exit(1);
    });
