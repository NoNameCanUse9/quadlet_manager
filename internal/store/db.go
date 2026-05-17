package store

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language             TEXT DEFAULT 'en',
    theme                TEXT DEFAULT 'dark',
    quadlet_dir          TEXT DEFAULT '',
    podman_socket        TEXT DEFAULT '',
    items_per_page       INTEGER DEFAULT 20,
    auto_refresh_seconds INTEGER DEFAULT 30,
    default_restart_policy TEXT DEFAULT 'always',
    notify_on_failure    BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`

func NewDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dsn+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
