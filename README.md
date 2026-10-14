# Banksajt med Docker

Samma banksajt (Next.js frontend + Express backend) som i huvuduppgiften,
men nu med data i en MySQL databas och allt körandes i Docker containrar.
Inloggningen använder bcrypt-hashade lösenord och en kortlivad JWT istället
för klartextlösenord och en sexsiffrig engångskod.

## Sajten live

http://18.209.43.23:3000

## Miljövariabler

| Variabel | Används av | Beskrivning |
| --- | --- | --- |
| `JWT_SECRET` | backend | Signeringsnyckel för JWT. Minst 32 byte slumpmässig sträng. Egna värden lokalt, i GitHub Actions (testnyckel) och på EC2 (produktionsnyckel), aldrig samma nyckel på flera ställen. |
| `NEXT_PUBLIC_API_URL` | frontend (byggtid) | Vilken adress frontendens JavaScript anropar backend på. |

Inga verkliga värden står här, bara vilka variabler som behövs.

## Köra lokalt

Kräver Docker Desktop.

Skapa en `.env`-fil i repots rot (bredvid `docker-compose.yml`) med en egen
slumpmässig nyckel:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

`.env` checkas aldrig in i Git.

```bash
docker compose up -d --build
```

Öppna sedan:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- MySQL (från en databasklient om man vill titta): localhost:3307

Stäng ner allt med:

```bash
docker compose down
```

Lägg till `--volumes` på slutet om du även vill radera databasen och börja
om helt från tomma tabeller nästa gång (behövs en gång efter att
lösenordskolumnen bytte namn till `password_hash`).

## Köra testerna

Vitest (backend, enhetstest av valideringslogik):

```bash
cd backend
npm test
```

Playwright (e2e, mot en separat testdatabas i `docker-compose.test.yml`):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.test.yml up -d --build
cd frontend
npx playwright test
```

GitHub Actions kör samma kedja automatiskt vid push till `main`: lint och
build av frontend, Vitest för backend, Playwright mot teststacken, och
deploy till EC2 bara om alla tre tidigare jobb är gröna.

Länk till en grön körning: https://github.com/elikyaliambi-ctrl/docker-banksajt/actions/runs/38590250712

## Köra på EC2

1. SSH in på instansen.
2. Installera Docker och git:

   ```bash
   sudo apt update
   sudo apt install -y git docker.io docker-compose-v2
   ```

3. Klona repot:

   ```bash
   git clone https://github.com/elikyaliambi-ctrl/docker-banksajt.git
   cd docker-banksajt
   ```

4. Bygg och starta, med frontendens API-url satt till instansens publika IP
   (annars försöker webbläsaren nå backend på "localhost", vilket pekar på
   besökarens egen dator, inte servern) och en egen produktionsnyckel:

   ```bash
   sudo JWT_SECRET=$(openssl rand -hex 32) NEXT_PUBLIC_API_URL=http://DIN-EC2-IP:3001 docker compose up -d --build
   ```

   (variablerna måste stå efter `sudo`, annars nollställs de och bygget
   hamnar fel)

   Framtida deploys sker automatiskt via GitHub Actions, som skickar in
   samma `JWT_SECRET` från ett repository secret varje gång.

5. Kontrollera att containrarna kör:

   ```bash
   sudo docker ps
   ```

## Struktur

```
frontend/        Next.js-appen. Access-token hålls bara i React state
                 (AuthContext), aldrig i localStorage.
backend/         Express-API:et. Lösenord hashas med bcrypt, inloggning ger
                 en JWT, skyddade routes går genom en egen requireAuth-
                 middleware.
database/
  init.sql       Skapar tabellerna users, accounts och transactions
                 automatiskt första gången MySQL-containern startar
docker-compose.yml
```

## Säkerhetsfrågor

**Varför kan du läsa en JWT-payload utan signeringsnyckeln, och vad skyddar
signaturen?**

Payloaden är bara Base64url-kodad, inte krypterad, så vem som helst kan
avkoda och läsa den utan nyckel. Signaturen skyddar inte innehållet från att
läsas, den skyddar mot att någon ändrar innehållet utan att det upptäcks.
Ändras ett tecken i payloaden matchar inte signaturen längre och
`jwt.verify()` nekar token.

**Vad händer om någon stjäl en giltig token innan den går ut? Stoppar en
signatur den personen?**

Nej. Signaturen bevisar bara att token är äkta, den hindrar inte någon som
har en giltig token från att använda den. Den som har token kan göra allt
den ger rätt till fram tills den går ut, därför är token kortlivad (15
minuter här).

**Vad är skillnaden mellan att hasha ett lösenord och att signera en
token?**

Att hasha ett lösenord med bcrypt är enkelriktat, man kan aldrig räkna
tillbaka lösenordet från hashen, bara jämföra ett nytt försök mot den
sparade hashen. Att signera en token innebär att servern skapar och senare
verifierar samma signatur med samma hemliga nyckel, för att kontrollera att
innehållet inte manipulerats, inte för att dölja det.

**Vilken risk finns med att lagra en token i localStorage om sidan får en
XSS-sårbarhet?**

Allt JavaScript som körs på sidan, även skadlig kod som smugits in via en
XSS-sårbarhet, kan läsa localStorage. Då kan koden stjäla token och använda
den som den inloggade användaren. Därför ligger token bara i React state i
den här uppgiften.

**Varför kan servern inte automatiskt veta att en JWT ska sluta gälla när
användaren klickar på Logga ut?**

En JWT är stateless, servern sparar ingen lista över utfärdade eller aktiva
token, den verifierar bara signatur och utgångstid vid varje anrop. Logga ut
i den här uppgiften rensar bara token i webbläsaren, token är fortfarande
giltig ur serverns perspektiv tills dess 15 minuter har gått.

**Vilka hemligheter finns i ert projekt, och var ska de lagras lokalt, i
GitHub Actions och på EC2?**

`JWT_SECRET` är den enda hemligheten som lagts till i den här uppgiften.
Lokalt ligger den i en `.env`-fil i repots rot som aldrig checkas in. I
GitHub Actions ligger en egen testnyckel som secreten `TEST_JWT_SECRET` och
produktionsnyckeln som secreten `JWT_SECRET`, båda bara läsbara av
workflowet. På EC2 skickas produktionsnyckeln in av deploy-jobbet via SSH
vid varje deploy, den sparas inte i någon fil på servern mellan deploys.
