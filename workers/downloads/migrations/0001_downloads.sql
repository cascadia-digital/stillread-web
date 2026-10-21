-- One row per day (UTC), file and source ('download' from the website, 'update' from Sparkle).
CREATE TABLE downloads (
    day    TEXT    NOT NULL,
    file   TEXT    NOT NULL,
    source TEXT    NOT NULL,
    count  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, file, source)
);
