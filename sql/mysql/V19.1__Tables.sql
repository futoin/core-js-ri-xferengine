
SET GLOBAL innodb_file_per_table=1;

-- Common
CREATE TABLE uuid_history (
    `_id` BIGINT NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';
-- Currencies

CREATE TABLE currencies (
    id SMALLINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    dec_places TINYINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL UNIQUE,
    symbol VARCHAR(3) NOT NULL UNIQUE,
    enabled ENUM('N', 'Y') NOT NULL,
    added TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';
    
CREATE TABLE exrates (
    base_id SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    foreign_id SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    rate DECIMAL(24, 12) NOT NULL,
    margin DECIMAL(24, 12) NOT NULL,
    since TIMESTAMP NOT NULL,
    PRIMARY KEY (base_id, foreign_id)
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';


-- Limits
CREATE TABLE limit_groups (
    `id` SMALLINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `group_name` VARCHAR(32) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';

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
    CHARACTER SET 'utf8';

-- Accounts
CREATE TABLE account_holders (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `ext_id` VARCHAR(128) NOT NULL UNIQUE,
    `group_id` SMALLINT UNSIGNED NOT NULL REFERENCES limit_groups(id),
    `enabled` ENUM('N', 'Y') NOT NULL,
    `kyc` ENUM('N', 'Y') NOT NULL,
    `data` TEXT NOT NULL,
    `internal` TEXT NOT NULL,
    `created` TIMESTAMP NOT NULL,
    `updated` TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';

CREATE TABLE accounts (
    `_id` INT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    `uuidb64` CHARACTER(22) NOT NULL UNIQUE,
    `holder` CHARACTER(22) NOT NULL REFERENCES account_holders(uuidb64),
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `created` TIMESTAMP NOT NULL,
    `updated` TIMESTAMP NOT NULL,
    `balance` DECIMAL(22, 0) NOT NULL,
    `reserved` DECIMAL(22, 0) NOT NULL,
    `enabled` ENUM('N', 'Y') NOT NULL,
    `acct_type` ENUM(
        'System',
        'External',
        'Transit',
        'Bonus'
    ) NOT NULL,
    `acct_alias` VARCHAR(20) NOT NULL,
    `rel_uuid64` CHARACTER(22) NULL REFERENCES accounts(uuidb64),
    `ext_acct_id` VARCHAR(64) NULL,
    UNIQUE `holder_alias` (`holder`, `acct_alias`)
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';

-- Xfers
