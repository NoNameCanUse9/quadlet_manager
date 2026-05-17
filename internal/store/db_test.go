package store

import (
	"testing"
)

func TestNewDB_CreatesTables(t *testing.T) {
	db, err := NewDB(":memory:")
	if err != nil {
		t.Fatalf("NewDB: %v", err)
	}
	defer db.Close()

	var name string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").Scan(&name)
	if err != nil {
		t.Fatalf("users table not found: %v", err)
	}

	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").Scan(&name)
	if err != nil {
		t.Fatalf("user_settings table not found: %v", err)
	}

	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='config'").Scan(&name)
	if err != nil {
		t.Fatalf("config table not found: %v", err)
	}
}
