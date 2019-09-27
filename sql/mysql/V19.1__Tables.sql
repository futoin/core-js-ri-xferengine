
-- SET GLOBAL innodb_file_per_table=1;

-- Common
CREATE TABLE uuid_history (
    `_id` BIGINT NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';
-- Currencies

CREATE TABLE currencies (
    id SMALLINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    code VARCHAR(18) NOT NULL UNIQUE,
    dec_places TINYINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL UNIQUE,
    symbol VARCHAR(18) NOT NULL UNIQUE,
    enabled ENUM('N', 'Y') NOT NULL,
    added DATETIME NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE exrates (
    base_id SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    foreign_id SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    rate DECIMAL(24, 12) NOT NULL,
    margin DECIMAL(24, 12) NOT NULL,
    since DATETIME NOT NULL,
    PRIMARY KEY (base_id, foreign_id)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';


-- Limits
CREATE TABLE limit_groups (
    `id` SMALLINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `group_name` VARCHAR(32) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE domain_limits (
    `lim_id` SMALLINT UNSIGNED NOT NULL REFERENCES limit_groups(`id`),
    `lim_domain` ENUM(
        'Retail',
        'Deposits',
        'Payments',
        'Gaming',
        'Misc',
        'Personnel'
    ) NOT NULL,
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `lim_hard` BLOB NOT NULL,
    `lim_check` BLOB NULL,
    `lim_risk` BLOB NULL,
    PRIMARY KEY(`lim_id`, `lim_domain`)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

-- Accounts
CREATE TABLE account_holders (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `ext_id` VARCHAR(128) NOT NULL UNIQUE,
    `group_id` SMALLINT UNSIGNED NOT NULL REFERENCES limit_groups(id),
    `enabled` ENUM('N', 'Y') NOT NULL,
    `kyc` ENUM('N', 'Y') NOT NULL,
    `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `internal` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `created` DATETIME NOT NULL,
    `updated` DATETIME NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE accounts (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `holder` CHARACTER(22) NOT NULL REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `created` DATETIME NOT NULL,
    `updated` DATETIME NOT NULL,
    `balance` DECIMAL(22, 0) NOT NULL,
    `reserved` DECIMAL(22, 0) NOT NULL,
    `enabled` ENUM('N', 'Y') NOT NULL,
    `acct_type` ENUM(
        'System',
        'Regular',
        'External',
        'Transit',
        'Bonus'
    ) NOT NULL,
    `acct_alias` VARCHAR(20) NOT NULL,
    `overdraft` DECIMAL(22, 0) NULL,
    `rel_uuidb64` CHARACTER(22) NULL REFERENCES accounts(uuidb64),
    `ext_acct_id` VARCHAR(64) NULL,
    UNIQUE `holder_alias` (`holder`, `acct_alias`),
    UNIQUE `holder_ext_acct_id` (`holder`, `ext_acct_id`)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE VIEW v_accounts AS
    SELECT A.uuidb64, A.holder, A.currency_id, A.balance,
           A.reserved, A.acct_type, rel_uuidb64, A.ext_acct_id,
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
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `retail_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `retail_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `retail_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `retail_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `retail_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `retail_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `preauth_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `preauth_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `preauth_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `preauth_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `preauth_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `preauth_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE limit_deposits_stats (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `deposit_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `deposit_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `withdrawal_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `withdrawal_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `deposit_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `deposit_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `withdrawal_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `withdrawal_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `deposit_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `deposit_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `withdrawal_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `withdrawal_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE limit_payments_stats (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `outbound_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `outbound_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `inbound_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `inbound_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `outbound_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `outbound_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `inbound_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `inbound_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `outbound_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `outbound_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `inbound_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `inbound_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE limit_gaming_stats (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `bet_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `bet_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `win_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `win_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `profit_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `bet_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `bet_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `win_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `win_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `profit_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `bet_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `bet_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `win_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `win_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `profit_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0'
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE limit_misc_stats (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `message_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `failure_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `limithit_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `message_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `failure_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `limithit_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `message_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `failure_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `limithit_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE limit_personnel_stats (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `holder` CHARACTER(22) NOT NULL UNIQUE REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `stats_date` DATE NOT NULL,
    `message_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `manual_daily_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `manual_daily_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `message_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `manual_weekly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `manual_weekly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `message_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    `manual_monthly_amt` DECIMAL(22, 0) NOT NULL DEFAULT '0',
    `manual_monthly_cnt` MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';


-- Xfers

CREATE TABLE xfers (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `src` CHARACTER(22) NOT NULL REFERENCES accounts(uuidb64),
    `src_currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `src_amount` DECIMAL(22, 0) NOT NULL,
    `dst` CHARACTER(22) NOT NULL REFERENCES accounts(uuidb64),
    `dst_currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `dst_amount` DECIMAL(22, 0) NOT NULL,
    `created` DATETIME NOT NULL,
    `updated` DATETIME NOT NULL,
    `xfer_type` ENUM(
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
    ) NOT NULL,
    `xfer_status` ENUM(
        'WaitUser',
        'WaitExtIn',
        'WaitExtOut',
        'Done',
        'Canceled',
        'Rejected'
    ) NOT NULL,
    `src_post_balance` DECIMAL(22, 0) NULL,
    `dst_post_balance` DECIMAL(22, 0) NULL,
    `extra_fee_id` CHARACTER(22) NULL REFERENCES xfers(uuidb64),
    `xfer_fee_id` CHARACTER(22) NULL REFERENCES xfers(uuidb64),
    -- Should be "real ext id : rel_account_id" - in that order
    `ext_id` VARCHAR(128) NULL UNIQUE,
    `misc_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE reservations (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `ext_id` VARCHAR(128) NOT NULL,
    `account` CHARACTER(22) NOT NULL REFERENCES accounts(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `amount` DECIMAL(22, 0) NOT NULL,
    `created` DATETIME NOT NULL,
    `cleared` DATETIME NULL,
    UNIQUE `src_ext_id` (`ext_id`, `account`)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

-- Gaming
CREATE TABLE rounds (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `round_id` CHARACTER(22) NOT NULL UNIQUE,
    `ext_round_id` VARCHAR(128) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

CREATE TABLE round_xfers (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `round_id` CHARACTER(22) NOT NULL REFERENCES rounds(round_id),
    `ext_id` VARCHAR(128) NOT NULL,
    UNIQUE `round_xfer` (`round_id`, `ext_id`)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

-- Retail
CREATE TABLE refunds (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `purchase_id` CHARACTER(22) NOT NULL REFERENCES xfers(uuidb64),
    `refund_id` CHARACTER(22) NOT NULL REFERENCES xfers(uuidb64),
    UNIQUE purchase_refund (`purchase_id`, `refund_id`)
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

-- Messages
CREATE TABLE messages (
    `_id` BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `ext_id` VARCHAR(128) NOT NULL UNIQUE,
    `sender`  CHARACTER(22) NOT NULL REFERENCES account_holders(uuidb64),
    `recipient`  CHARACTER(22) NULL REFERENCES account_holders(uuidb64),
    `rel_uuidb64` CHARACTER(22) NULL REFERENCES messages(uuidb64),
    `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `created` DATETIME NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'latin1';

