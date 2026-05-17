package auth

import (
	"testing"
	"time"
)

func TestJWT_CreateAndValidate(t *testing.T) {
	secret := []byte("test-secret-key-32-bytes-long!!")
	token, err := CreateToken(secret, 1, "admin", "admin", 24*time.Hour)
	if err != nil {
		t.Fatalf("CreateToken: %v", err)
	}

	claims, err := ValidateToken(secret, token)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	if claims.UserID != 1 {
		t.Errorf("expected userID 1, got %d", claims.UserID)
	}
	if claims.Username != "admin" {
		t.Errorf("expected admin, got %s", claims.Username)
	}
	if claims.Role != "admin" {
		t.Errorf("expected admin role, got %s", claims.Role)
	}
}

func TestJWT_InvalidToken(t *testing.T) {
	secret := []byte("test-secret-key-32-bytes-long!!")
	_, err := ValidateToken(secret, "invalid.token.here")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}

func TestJWT_WrongSecret(t *testing.T) {
	secret1 := []byte("test-secret-key-32-bytes-long!!")
	secret2 := []byte("different-secret-key-32-bytes!")
	token, _ := CreateToken(secret1, 1, "u", "user", time.Hour)

	_, err := ValidateToken(secret2, token)
	if err == nil {
		t.Fatal("expected error with wrong secret")
	}
}

func TestJWT_ExpiredToken(t *testing.T) {
	secret := []byte("test-secret-key-32-bytes-long!!")
	token, _ := CreateToken(secret, 1, "u", "user", -1*time.Hour)

	_, err := ValidateToken(secret, token)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestGenerateSecret(t *testing.T) {
	s1, _ := GenerateSecret()
	s2, _ := GenerateSecret()
	if len(s1) < 32 {
		t.Errorf("expected 32+ bytes, got %d", len(s1))
	}
	if string(s1) == string(s2) {
		t.Error("secrets should be unique")
	}
}
