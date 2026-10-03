import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Genererar ett sexsiffrigt engångslösenord
function generateOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
}

// Datat lagras nu i en MySQL-databas som körs i en egen container.
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

// Slår upp vilket userId ett engångslösenord tillhör
async function getUserIdFromToken(token) {
    const rows = await query('SELECT userId FROM sessions WHERE token = ?', [token]);
    return rows[0] ? rows[0].userId : undefined;
}

// Skapar en ny användare och ett tillhörande konto med 0 kr i saldo
app.post('/users', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Användarnamn och lösenord krävs' });
    }

    try {
        const result = await query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, password],
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

// Loggar in användaren och skapar ett engångslösenord (token)
app.post('/sessions', async (req, res) => {
    const { username, password } = req.body;

    const rows = await query(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
    );
    const user = rows[0];

    if (!user) {
        return res.status(401).json({ error: 'Fel användarnamn eller lösenord' });
    }

    const token = generateOTP();
    await query('INSERT INTO sessions (userId, token) VALUES (?, ?)', [user.id, token]);

    res.status(200).json({ token });
});

// Returnerar saldot för kontot som hör till token
app.post('/me/accounts', async (req, res) => {
    const { token } = req.body;
    const userId = await getUserIdFromToken(token);

    if (!userId) {
        return res.status(401).json({ error: 'Ogiltigt engångslösenord' });
    }

    const rows = await query('SELECT amount FROM accounts WHERE userId = ?', [userId]);

    res.status(200).json({ amount: rows[0].amount });
});

// Sätter in pengar på kontot och returnerar det nya saldot
app.post('/me/accounts/transactions', async (req, res) => {
    const { token, amount } = req.body;
    const userId = await getUserIdFromToken(token);

    if (!userId) {
        return res.status(401).json({ error: 'Ogiltigt engångslösenord' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Ogiltigt belopp' });
    }

    const rows = await query('SELECT amount FROM accounts WHERE userId = ?', [userId]);
    const newAmount = rows[0].amount + amount;
    await query('UPDATE accounts SET amount = ? WHERE userId = ?', [newAmount, userId]);

    res.status(200).json({ amount: newAmount });
});

// Starta servern
app.listen(port, () => {
    console.log(`Bankens backend körs på http://localhost:${port}`);
});
