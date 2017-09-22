
-- Common
CREATE TYPE enabled_enum AS ENUM('N', 'Y');

-- Yes, PostgreSQL does have UUID type
CREATE DOMAIN uuid_b64 AS CHARACTER(22);
CREATE TABLE uuid_history (
    "uuidb64" uuid_b64 NOT NULL PRIMARY KEY
);


-- Currencies

CREATE DOMAIN currency_code AS VARCHAR(10);
CREATE DOMAIN currency_dec_places AS SMALLINT
    CHECK( VALUE >= 0 AND VALUE <= 12 );
CREATE DOMAIN currency_id AS INT;

CREATE TABLE currencies (
    "id" serial NOT NULL PRIMARY KEY,
    "code" currency_code NOT NULL UNIQUE,
    "dec_places" currency_dec_places NOT NULL,
    "name" VARCHAR(64) NOT NULL UNIQUE,
    "symbol" VARCHAR(3) NOT NULL UNIQUE,
    "enabled" enabled_enum NOT NULL,
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
    "group_name" VARCHAR(32) NOT NULL UNIQUE
);

CREATE TYPE limit_domain AS ENUM(
    'Retail',
    'Deposits',
    'Payments',
    'Gaming',
    'Misc',
    'Personnel'
);

CREATE TABLE domain_limits (
    "lim_id" integer NOT NULL REFERENCES limit_groups("id"),
    "lim_domain" limit_domain NOT NULL,
    "currency_id" currency_id NOT NULL REFERENCES currencies("id"),
    "lim_hard" JSON NOT NULL,
    "lim_check" JSON NULL,
    "lim_risk" JSON NULL,
    PRIMARY KEY ("lim_id", "lim_domain")
);


-- Accounts
CREATE DOMAIN ext_holder_id AS VARCHAR(128);
CREATE TABLE account_holders (
    "uuidb64" uuid_b64 NOT NULL UNIQUE,
    "ext_id" ext_holder_id NOT NULL UNIQUE,
    "group_id" integer NOT NULL REFERENCES limit_groups(id),
    "enabled" enabled_enum NOT NULL,
    "kyc" enabled_enum NOT NULL,
    "data" JSON NOT NULL,
    "internal" JSON NOT NULL,
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL
);

CREATE DOMAIN acct_alias AS VARCHAR(20);
CREATE DOMAIN ext_acct_id AS VARCHAR(64);
CREATE TYPE acct_type AS ENUM(
    'System',
    'External',
    'Transit',
    'Bonus'
);
CREATE TABLE accounts (
    "uuidb64" uuid_b64 NOT NULL PRIMARY KEY,
    "holder" uuid_b64 NOT NULL REFERENCES account_holders(uuidb64),
    "currency_id" currency_id NOT NULL REFERENCES currencies(id),
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL,
    "balance" DECIMAL(22, 0) NOT NULL,
    "reserved" DECIMAL(22, 0) NOT NULL,
    "enabled" enabled_enum NOT NULL,
    "acct_type" acct_type NOT NULL,
    "acct_alias" acct_alias NOT NULL,
    "rel_uuid64" uuid_b64 NULL REFERENCES accounts(uuidb64),
    "ext_acct_id" ext_acct_id NULL,
    CONSTRAINT "holder_alias" UNIQUE ("holder", "acct_alias")
);

-- Xfers
