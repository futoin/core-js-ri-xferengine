
-- Common
CREATE TYPE enabled_enum AS ENUM('N', 'Y');
CREATE DOMAIN amount AS DECIMAL(22, 0);

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
    'Regular',
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
    "balance" amount NOT NULL,
    "reserved" amount NOT NULL,
    "enabled" enabled_enum NOT NULL,
    "acct_type" acct_type NOT NULL,
    "acct_alias" acct_alias NOT NULL,
    "overdraft" amount NULL,
    "rel_uuidb64" uuid_b64 NULL REFERENCES accounts(uuidb64),
    "ext_acct_id" ext_acct_id NULL,
    CONSTRAINT "holder_alias" UNIQUE ("holder", "acct_alias"),
    CONSTRAINT "holder_ext_acct_id" UNIQUE ("holder", "ext_acct_id")
);

CREATE VIEW v_accounts AS
    SELECT A.uuidb64, A.holder, A.currency_id, A.balance,
           A.reserved, A.acct_type, A.rel_uuidb64, A.ext_acct_id,
           COALESCE( A.overdraft, '0' ) AS overdraft,
           C.code AS currency, C.dec_places,
           H.ext_id AS ext_holder_id,
           A.enabled AS account_enabled,
           H.enabled AS holder_enabled,
           A.created AS account_created
      FROM accounts A
      JOIN account_holders H ON (H.uuidb64 = A.holder)
      JOIN currencies C ON (C.id = A.currency_id);

-- Account limit stats

CREATE TABLE limit_retail_stats (
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "retail_daily_amt" amount NOT NULL DEFAULT '0',
    "retail_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "retail_weekly_amt" amount NOT NULL DEFAULT '0',
    "retail_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "retail_monthly_amt" amount NOT NULL DEFAULT '0',
    "retail_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "preauth_daily_amt" amount NOT NULL DEFAULT '0',
    "preauth_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "preauth_weekly_amt" amount NOT NULL DEFAULT '0',
    "preauth_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "preauth_monthly_amt" amount NOT NULL DEFAULT '0',
    "preauth_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE limit_deposits_stats (
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "deposit_daily_amt" amount NOT NULL DEFAULT '0',
    "deposit_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_daily_amt" amount NOT NULL DEFAULT '0',
    "withdrawal_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "deposit_weekly_amt" amount NOT NULL DEFAULT '0',
    "deposit_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_weekly_amt" amount NOT NULL DEFAULT '0',
    "withdrawal_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "deposit_monthly_amt" amount NOT NULL DEFAULT '0',
    "deposit_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "withdrawal_monthly_amt" amount NOT NULL DEFAULT '0',
    "withdrawal_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);
    
CREATE TABLE limit_payments_stats (
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "outbound_daily_amt" amount NOT NULL DEFAULT '0',
    "outbound_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_daily_amt" amount NOT NULL DEFAULT '0',
    "inbound_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "outbound_weekly_amt" amount NOT NULL DEFAULT '0',
    "outbound_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_weekly_amt" amount NOT NULL DEFAULT '0',
    "inbound_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "outbound_monthly_amt" amount NOT NULL DEFAULT '0',
    "outbound_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "inbound_monthly_amt" amount NOT NULL DEFAULT '0',
    "inbound_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE limit_gaming_stats (
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "bet_daily_amt" amount NOT NULL DEFAULT '0',
    "bet_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_daily_amt" amount NOT NULL DEFAULT '0',
    "win_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_daily_amt" amount NOT NULL DEFAULT '0',
    "bet_weekly_amt" amount NOT NULL DEFAULT '0',
    "bet_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_weekly_amt" amount NOT NULL DEFAULT '0',
    "win_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_weekly_amt" amount NOT NULL DEFAULT '0',
    "bet_monthly_amt" amount NOT NULL DEFAULT '0',
    "bet_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "win_monthly_amt" amount NOT NULL DEFAULT '0',
    "win_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "profit_monthly_amt" amount NOT NULL DEFAULT '0'
);

CREATE TABLE limit_misc_stats (
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
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
    "holder" uuid_b64 NOT NULL PRIMARY KEY REFERENCES account_holders(uuidb64),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "stats_date" DATE NOT NULL,
    "message_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_daily_amt" amount NOT NULL DEFAULT '0',
    "manual_daily_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_weekly_amt" amount NOT NULL DEFAULT '0',
    "manual_weekly_cnt" INTEGER NOT NULL DEFAULT 0,
    "message_monthly_cnt" INTEGER NOT NULL DEFAULT 0,
    "manual_monthly_amt" amount NOT NULL DEFAULT '0',
    "manual_monthly_cnt" INTEGER NOT NULL DEFAULT 0
);

-- Xfers

CREATE TYPE xfer_type AS ENUM(
    -- Deposits
    'Deposit',
    'Withdrawal',
    -- Retail
    'Purchase',
    'Refund',
    'PreAuth',
    -- Gaming
    'Bet',
    'Win',
    -- Bonus
    'Bonus',
    'ReleaseBonus',
    'CancelBonus',
    --
    'Fee',
    'Settle',
    'Generic'
);
CREATE TYPE xfer_status AS ENUM(
    'WaitUser',
    'WaitExtIn',
    'WaitExtOut',
    'Done',
    'Canceled',
    'Rejected'
);

CREATE DOMAIN ext_xfer_id AS VARCHAR(128);

CREATE TABLE xfers (
    "uuidb64" uuid_b64 NOT NULL PRIMARY KEY,
    "src" uuid_b64 NOT NULL REFERENCES accounts(uuidb64),
    "src_currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "src_amount" amount NOT NULL,
    "dst" uuid_b64 NOT NULL REFERENCES accounts(uuidb64),
    "dst_currency_id" SMALLINT NOT NULL REFERENCES currencies(id),
    "dst_amount" amount NOT NULL,
    "created" TIMESTAMP NOT NULL,
    "updated" TIMESTAMP NOT NULL,
    "xfer_type" xfer_type NOT NULL,
    "xfer_status" xfer_status NOT NULL,
    "src_post_balance" amount NULL,
    "dst_post_balance" amount NULL,
    "extra_fee_id" uuid_b64 NULL REFERENCES xfers(uuidb64)
        DEFERRABLE INITIALLY DEFERRED,
    "xfer_fee_id" uuid_b64 NULL REFERENCES xfers(uuidb64)
        DEFERRABLE INITIALLY DEFERRED,
    -- Should be "real ext id : rel_account_id" - in that order
    "ext_id" ext_xfer_id NULL UNIQUE,
    "misc_data" TEXT NULL
);

CREATE TABLE reservations (
    "ext_id" ext_xfer_id NOT NULL,
    "account" uuid_b64 NOT NULL REFERENCES accounts("uuidb64"),
    "currency_id" SMALLINT NOT NULL REFERENCES currencies("id"),
    "amount" amount NOT NULL,
    "created" TIMESTAMP NOT NULL,
    "cleared" TIMESTAMP NULL,
    PRIMARY KEY ("ext_id", "account")
);

-- Gaming
CREATE TABLE rounds (
    "round_id" uuid_b64 PRIMARY KEY,
    "ext_round_id" ext_xfer_id UNIQUE
);

CREATE TABLE round_xfers (
    "round_id" uuid_b64 NOT NULL REFERENCES rounds(round_id),
    "ext_id" ext_xfer_id NOT NULL,
    PRIMARY KEY ("round_id", "ext_id")
);
