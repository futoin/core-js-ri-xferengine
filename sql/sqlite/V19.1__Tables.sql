
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
    "overdraft" DECIMAL(22, 0) NULL,
    "rel_uuidb64" CHARACTER(22) NULL REFERENCES accounts(uuidb64),
    "ext_acct_id" VARCHAR(64) NULL,
    CONSTRAINT "holder_alias" UNIQUE ("holder", "acct_alias")
);

CREATE VIEW v_accounts AS
    SELECT A.uuidb64, A.holder, A.currency_id, A.balance,
           A.reserved, A.acct_type, A.rel_uuidb64, A.ext_acct_id,
           COALESCE( A.overdraft, '0' ),
           C.code AS currency, C.dec_places,
           A.enabled AS account_enabled,
           H.enabled AS holder_enabled
      FROM accounts A
      JOIN account_holders H ON (H.uuidb64 = A.holder)
      JOIN currencies C ON (C.id = A.currency_id);

-- Account limit stats

CREATE TABLE limit_retail_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "retail_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "retail_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "retail_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "retail_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "retail_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "retail_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE limit_deposits_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "deposit_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "deposit_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "withdrawal_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "deposit_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "deposit_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "withdrawal_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "deposit_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "deposit_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "withdrawal_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);
    
CREATE TABLE limit_payments_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "outbound_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "outbound_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "inbound_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "outbound_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "outbound_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "inbound_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "outbound_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "outbound_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "inbound_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE limit_gaming_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "bet_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "bet_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "win_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "bet_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "bet_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "win_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "bet_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "bet_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "win_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0'
);

CREATE TABLE limit_misc_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "message_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "failure_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "limithit_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "failure_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "limithit_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "failure_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "limithit_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE limit_personnel_stats (
    "holder" CHARACTER(22) NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "message_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_daily_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "manual_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_weekly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "manual_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_monthly_amt" DECIMAL(22, 0) NOT NULL DEFAULT '0',
    "manual_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

-- Xfers

CREATE TABLE active_xfers (
    "uuidb64" CHARACTER(22) NOT NULL PRIMARY KEY,
    "src" CHARACTER(22) NOT NULL REFERENCES accounts(uuidb64),
    "src_currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "src_amount" DECIMAL(22, 0) NOT NULL,
    "dst" CHARACTER(22) NOT NULL REFERENCES accounts(uuidb64),
    "dst_currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "dst_amount" DECIMAL(22, 0) NOT NULL,
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL,
    "xfer_type" VARCHAR(16) NOT NULL,
    "xfer_status" VARCHAR(10) NOT NULL,
    "fee_id" CHARACTER(22) NULL REFERENCES active_xfers(uuidb64),
    -- Should be "real ext id : rel_account_id" - in that order
    "ext_id" VARCHAR(128) NULL UNIQUE,
    "misc_data" TEXT NULL
);

