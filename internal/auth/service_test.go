package auth

import (
	"testing"

	"github.com/choken/quadlet-manager/internal/store"
)

func newTestService(t *testing.T) *Service {
	t.Helper()
	db, err := store.NewDB(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	secret := []byte("test-secret-key-32-bytes-long!!")
	return NewService(db, secret)
}

func TestService_RegisterAndLogin(t *testing.T) {
	svc := newTestService(t)

	err := svc.Register("alice", "password123", "admin")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	token, user, err := svc.Login("alice", "password123")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if user.Username != "alice" {
		t.Errorf("expected alice, got %s", user.Username)
	}
}

func TestService_Login_WrongPassword(t *testing.T) {
	svc := newTestService(t)
	svc.Register("bob", "correct", "user")

	_, _, err := svc.Login("bob", "wrong")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
}

func TestService_Login_WrongUsername(t *testing.T) {
	svc := newTestService(t)

	_, _, err := svc.Login("nobody", "pass")
	if err == nil {
		t.Fatal("expected error for nonexistent user")
	}
}

func TestService_Register_Duplicate(t *testing.T) {
	svc := newTestService(t)
	svc.Register("dup", "pass", "user")

	err := svc.Register("dup", "pass2", "user")
	if err == nil {
		t.Fatal("expected error for duplicate username")
	}
}

func TestService_HasAdmin(t *testing.T) {
	svc := newTestService(t)

	if svc.HasAdmin() {
		t.Fatal("should have no admin initially")
	}
	svc.Register("admin", "pass", "admin")
	if !svc.HasAdmin() {
		t.Fatal("should have admin after register")
	}
}
