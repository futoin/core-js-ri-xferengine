
-- Currencies

CREATE DOMAIN currency_code AS VARCHAR(10); 
CREATE TYPE currency_enabled AS ENUM('N', 'Y');
CREATE DOMAIN currency_dec_places AS SMALLINT
    CHECK( VALUE >= 0 AND VALUE <= 12 );
CREATE DOMAIN currency_id AS INT;

CREATE TABLE currencies (
    "id" serial NOT NULL PRIMARY KEY,
    "code" currency_code NOT NULL UNIQUE,
    "dec_places" currency_dec_places NOT NULL,
    "name" VARCHAR(64) NOT NULL UNIQUE,
    "symbol" VARCHAR(3) NOT NULL UNIQUE,
    "enabled" currency_enabled NOT NULL,
    "added" TIMESTAMP NOT NULL
);

CREATE DOMAIN currency_exrate AS DECIMAL(24, 12);
    
CREATE TABLE exrates (
    "base_id" currency_id NOT NULL REFERENCES currencies("id"),
    "foreign_id" currency_id NOT NULL REFERENCES currencies("id"),
    "rate" currency_exrate NOT NULL,
    "margin" currency_exrate NOT NULL,
    "since" TIMESTAMP NOT NULL,
    PRIMARY KEY ("base_id", "foreign_id")
);


-- Limits
CREATE TABLE limit_groups (
    "id" serial NOT NULL PRIMARY KEY,
    "group" VARCHAR(32) NOT NULL UNIQUE
);

CREATE TYPE limit_domain AS ENUM(
    'Ratail',
    'Deposits',
    'Payments',
    'Gaming',
    'Misc',
    'Personnel'
);

CREATE TABLE domain_limits (
    "limit_id" SMALLINT NOT NULL REFERENCES limit_groups("id"),
    "domain" limit_domain NOT NULL,
    "currency_id" currency_id NOT NULL REFERENCES currencies("id"),
    "hard" JSON NOT NULL,
    "check" JSON NOT NULL,
    "risk" JSON NOT NULL,
    PRIMARY KEY ("limit_id", "domain")
);


-- Xfers
