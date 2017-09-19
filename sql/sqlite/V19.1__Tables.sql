

-- Currencies

CREATE TABLE currencies (
    id INTEGER NOT NULL PRIMARY KEY autoincrement,
    code VARCHAR(10) NOT NULL UNIQUE,
    dec_places TINYINT NOT NULL,
    name VARCHAR(64) NOT NULL UNIQUE,
    symbol VARCHAR(3) NOT NULL UNIQUE,
    enabled CHARACTER(1) NOT NULL,
    added TIMESTAMP NOT NULL
);
    
CREATE TABLE exrates (
    base_id INTEGER NOT NULL,
    foreign_id INTEGER NOT NULL,
    -- rate DECIMAL(24, 12) NOT NULL,
    rate VARCHAR(25) NOT NULL,
    -- margin DECIMAL(24, 12) NOT NULL,
    margin VARCHAR(25) NOT NULL,
    since TIMESTAMP NOT NULL,
    CONSTRAINT base_foreign UNIQUE (base_id, foreign_id)
);


-- Limits

-- Xfers
