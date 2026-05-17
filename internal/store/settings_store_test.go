package store

import (
	"testing"
)

func TestSettingsStore_CreateAndGet(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)
	ss := NewSettingsStore(db)

	uid, _ := us.Create("u", "h", "user")

	settings, err := ss.GetByUserID(uid)
	if err != nil {
		t.Fatalf("GetByUserID: %v", err)
	}
	if settings.Language != "en" {
		t.Errorf("default lang should be en, got %s", settings.Language)
	}
	if settings.ItemsPerPage != 20 {
		t.Errorf("default items_per_page should be 20, got %d", settings.ItemsPerPage)
	}
}

func TestSettingsStore_Update(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)
	ss := NewSettingsStore(db)

	uid, _ := us.Create("u", "h", "user")

	// First call creates default row
	ss.GetByUserID(uid)

	err := ss.Update(uid, map[string]interface{}{
		"language":       "zh",
		"theme":          "light",
		"items_per_page": 50,
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	settings, _ := ss.GetByUserID(uid)
	if settings.Language != "zh" {
		t.Errorf("expected zh, got %s", settings.Language)
	}
	if settings.Theme != "light" {
		t.Errorf("expected light, got %s", settings.Theme)
	}
	if settings.ItemsPerPage != 50 {
		t.Errorf("expected 50, got %d", settings.ItemsPerPage)
	}
}
