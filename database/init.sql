-- Skapar tabellerna banksajten behöver. Körs automatiskt av MySQL-containern
-- första gången den startar (via docker-entrypoint-initdb.d).

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId INT UNSIGNED NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId INT UNSIGNED NOT NULL,
  token VARCHAR(6) NOT NULL,
  PRIMARY KEY (id)
);

-- Transaktionshistorik, en rad per insättning (och senare uttag).
-- OBS: den här filen körs bara automatiskt av MySQL-containern när en helt
-- ny databasvolym skapas. Backend skapar därför samma tabell själv vid
-- uppstart (CREATE TABLE IF NOT EXISTS) så befintliga installationer också
-- får tabellen utan att databasen behöver nollställas.
CREATE TABLE IF NOT EXISTS transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  accountId INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'deposit',
  amount INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY transactions_accountId_idx (accountId)
);
