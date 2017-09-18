
SET GLOBAL innodb_file_per_table=1;

-- Currencies

CREATE TABLE currencies (
    id SMALLINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    dec_places TINYINT UNSIGNED NOT NULL,
    name VARCHAR(64) NOT NULL UNIQUE,
    symbol VARCHAR(3) NOT NULL UNIQUE,
    enabled TINYINT UNSIGNED NOT NULL,
    added TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';
    
CREATE TABLE exrates (
    _rate_id MEDIUMINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    base_id SMALLINT UNSIGNED NOT NULL,
    foreign_id SMALLINT UNSIGNED NOT NULL,
    rate DECIMAL(24, 12) NOT NULL,
    margin DECIMAL(24, 12) NOT NULL,
    since TIMESTAMP NOT NULL,
    UNIQUE base_foreign (base_id, foreign_id)
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8';


-- Limits

-- Xfers
