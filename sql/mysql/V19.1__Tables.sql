
SET GLOBAL innodb_file_per_table=1;

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
    `group` VARCHAR(32) NOT NULL UNIQUE
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';

CREATE TABLE domain_limits (
    `limit_id` SMALLINT UNSIGNED NOT NULL REFERENCES limit_groups(`id`),
    `domain` ENUM(
        'Ratail',
        'Deposits',
        'Payments',
        'Gaming',
        'Misc',
        'Personnel'
    ) NOT NULL,
    `currency_id` SMALLINT UNSIGNED NOT NULL REFERENCES currencies(id),
    `hard` BLOB NOT NULL,
    `check` BLOB NOT NULL,
    `risk` BLOB NOT NULL,
    PRIMARY KEY(`limit_id`, `domain`)
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';


-- Xfers
