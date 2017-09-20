

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
    "lim_id" SMALLINT NOT NULL REFERENCES limit_groups("id"),
    "lim_domain" VARCHAR(16) NOT NULL,
    "currency_id" INTEGER NOT NULL REFERENCES currencies("id"),
    "lim_hard" TEXT NOT NULL,
    "lim_check" TEXT NULL,
    "lim_risk" TEXT NULL,
    PRIMARY KEY ("lim_id", "lim_domain")
);


-- Xfers
