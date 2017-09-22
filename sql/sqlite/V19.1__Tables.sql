
-- Common
CREATE TABLE uuid_history (
    "uuidb64" CHARACTER(22) NOT NULL PRIMARY KEY
);

-- Currencies

CREATE TABLE currencies (
    "id" INTEGER NOT NULL PRIMARY KEY autoincrement,
    "code" VARCHAR(10) NOT NULL UNIQUE,
    "dec_places" TINYINT NOT NULL,
    "name" VARCHAR(64) NOT NULL UNIQUE,
    "symbol" VARCHAR(3) NOT NULL UNIQUE,
    "enabled" CHARACTER(1) NOT NULL,
    "added" TIMESTAMP NOT NULL
);
    
CREATE TABLE exrates (
    "base_id" INTEGER NOT NULL REFERENCES currencies("id"),
    "foreign_id" INTEGER NOT NULL REFERENCES currencies("id"),
    -- rate DECIMAL(24, 12) NOT NULL,
    "rate" VARCHAR(25) NOT NULL,
    -- margin DECIMAL(24, 12) NOT NULL,
    "margin" VARCHAR(25) NOT NULL,
    "since" TIMESTAMP NOT NULL,
    CONSTRAINT base_foreign UNIQUE ("base_id", "foreign_id")
);


-- Limits
CREATE TABLE limit_groups (
    "id" INTEGER NOT NULL PRIMARY KEY autoincrement,
    "group_name" VARCHAR(32) NOT NULL UNIQUE
);

CREATE TABLE domain_limits (
    "lim_id" INTEGER NOT NULL REFERENCES limit_groups("id"),
    "lim_domain" VARCHAR(16) NOT NULL,
    "currency_id" INTEGER NOT NULL REFERENCES currencies("id"),
    "lim_hard" TEXT NOT NULL,
    "lim_check" TEXT NULL,
    "lim_risk" TEXT NULL,
    PRIMARY KEY ("lim_id", "lim_domain")
);

-- Accounts
CREATE TABLE account_holders (
    "uuidb64" CHARACTER(22) NOT NULL UNIQUE,
    "ext_id" VARCHAR(128) NOT NULL UNIQUE,
    "group_id" INTEGER NOT NULL REFERENCES limit_groups(id),
    "enabled" CHARACTER(1) NOT NULL,
    "kyc" CHARACTER(1) NOT NULL,
    "data" TEXT NOT NULL,
    "internal" TEXT NOT NULL,
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL
);


CREATE TABLE accounts (
    "uuidb64" CHARACTER(22) NOT NULL PRIMARY KEY,
    "holder" CHARACTER(22) NOT NULL REFERENCES account_holders(uuidb64),
    "currency_id" INTEGER NOT NULL REFERENCES currencies(id),
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL,
    "balance" DECIMAL(22, 0) NOT NULL,
    "reserved" DECIMAL(22, 0) NOT NULL,
    "enabled" CHARACTER(1) NOT NULL,
    "acct_type" VARCHAR(8) NOT NULL,
    "acct_alias" VARCHAR(20) NOT NULL,
    "rel_uuid64" CHARACTER(22) NULL REFERENCES accounts(uuidb64),
    "ext_acct_id" VARCHAR(64) NULL,
    CONSTRAINT "holder_alias" UNIQUE ("holder", "acct_alias")
);


-- Xfers
