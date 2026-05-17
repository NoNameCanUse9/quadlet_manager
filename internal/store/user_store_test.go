package store

import (
	"testing"
)

func TestUserStore_CreateAndGet(t *testing.T) {
	db, err := NewDB(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	us := NewUserStore(db)

	id, err := us.Create("alice", "hash123", "admin")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	user, err := us.GetByID(id)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if user.Username != "alice" {
		t.Errorf("expected alice, got %s", user.Username)
	}
	if user.Role != "admin" {
		t.Errorf("expected admin, got %s", user.Role)
	}
}

func TestUserStore_GetByUsername(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	us.Create("bob", "hash456", "user")
	user, err := us.GetByUsername("bob")
	if err != nil {
		t.Fatalf("GetByUsername: %v", err)
	}
	if user.Username != "bob" {
		t.Errorf("expected bob, got %s", user.Username)
	}
}

func TestUserStore_GetByUsername_NotFound(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	_, err := us.GetByUsername("nobody")
	if err == nil {
		t.Fatal("expected error for nonexistent user")
	}
}

func TestUserStore_ListAll(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	us.Create("a", "h", "admin")
	us.Create("b", "h", "user")

	users, err := us.ListAll()
	if err != nil {
		t.Fatalf("ListAll: %v", err)
	}
	if len(users) != 2 {
		t.Errorf("expected 2 users, got %d", len(users))
	}
}

func TestUserStore_Delete(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	id, _ := us.Create("del", "h", "user")
	err := us.Delete(id)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err = us.GetByID(id)
	if err == nil {
		t.Fatal("expected error after delete")
	}
}

func TestUserStore_HasAdmin(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	if us.HasAdmin() {
		t.Fatal("should have no admin initially")
	}
	us.Create("admin", "h", "admin")
	if !us.HasAdmin() {
		t.Fatal("should have admin after creation")
	}
}

func TestUserStore_UpdateRole(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	id, _ := us.Create("u", "h", "user")
	err := us.UpdateRole(id, "admin")
	if err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	user, _ := us.GetByID(id)
	if user.Role != "admin" {
		t.Errorf("expected admin, got %s", user.Role)
	}
}

func TestUserStore_UpdatePassword(t *testing.T) {
	db, _ := NewDB(":memory:")
	defer db.Close()
	us := NewUserStore(db)

	id, _ := us.Create("u", "old", "user")
	err := us.UpdatePassword(id, "new")
	if err != nil {
		t.Fatalf("UpdatePassword: %v", err)
	}
}
