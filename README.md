# Banksajt med Docker

Samma banksajt (Next.js frontend + Express backend) som i huvuduppgiften,
men nu med data i en MySQL databas och allt körandes i Docker containrar.

## Sajten live

https://ÄNDRA-TILL-DIN-EC2-ADRESS-HÄR:3000

## Köra lokalt

Kräver bara Docker Desktop.

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
om helt från tomma tabeller nästa gång.

## Köra på EC2

1. SSH in på instansen.
2. Installera Docker och git:

   ```bash
   sudo apt update
   sudo apt install -y git docker.io docker-compose-v2
   ```

3. Klona repot:

   ```bash
   git clone https://github.com/ANVÄNDARNAMN/docker-banksajt.git
   cd docker-banksajt
   ```

4. Bygg och starta, med frontendens API-url satt till instansens publika IP
   (annars försöker webbläsaren nå backend på "localhost", vilket pekar på
   besökarens egen dator, inte servern):

   ```bash
   NEXT_PUBLIC_API_URL=http://DIN-EC2-IP:3001 sudo docker compose up -d --build
   ```

5. Kontrollera att containrarna kör:

   ```bash
   sudo docker ps
   ```

## Struktur

```
frontend/        Next.js-appen (oförändrad kod, bara en Dockerfile tillagd)
backend/         Express-API:et, pratar nu med MySQL via mysql2 istället för
                 en array eller SQLite-fil
database/
  init.sql       Skapar tabellerna users, accounts och sessions automatiskt
                 första gången MySQL-containern startar
docker-compose.yml
```
