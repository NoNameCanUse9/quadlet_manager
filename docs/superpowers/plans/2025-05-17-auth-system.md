# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-user authentication with JWT, SQLite storage, and per-user settings to Quadlet Manager.

**Architecture:** SQLite stores users (bcrypt passwords) and per-user UI settings. JWT middleware protects API endpoints. Frontend has login/init pages with route guards.

**Tech Stack:** Go, gin, golang-jwt/jwt/v5, golang.org/x/crypto/bcrypt, mattn/go-sqlite3, React, Zustand

---

## File Structure

```
internal/
├── auth/
│   ├── jwt.go              # JWT create/validate helpers
│   ├── jwt_test.go         # JWT tests
│   ├── service.go          # Auth service (register, login, hash)
│   └── service_test.go     # Auth service tests
├── middleware/
│   └── auth.go             # JWTAuth + RequireRole middleware
├── handler/
│   ├── auth_handler.go     # Auth REST handlers
│   ├── auth_handler_test.go
│   ├── settings_handler.go # Settings REST handlers
│   └── settings_handler_test.go
├── store/
│   ├── db.go               # SQLite connection + migrations
│   ├── db_test.go
│   ├── user_store.go       # User CRUD
│   ├── user_store_test.go
│   ├── settings_store.go   # Settings CRUD
│   └── settings_store_test.go
├── model/
│   └── user.go             # User + UserSettings models
web/src/
├── store/useAuth.ts        # Auth state (Zustand)
├── pages/
│   ├── LoginPage.tsx
│   ├── InitPage.tsx
│   └── AdminUsersPage.tsx
├── components/
│   └── AuthGuard.tsx       # Route guard component
├── api/client.ts           # Add JWT header to requests
├── router/index.tsx        # Add auth routes
```

---

## Task 1: Dependencies + SQLite Setup

**Files:**
- Create: `internal/store/db.go`
- Create: `internal/store/db_test.go`
- Modify: `go.mod`

- [ ] **Step 1: Install Go dependencies**

```bash
go get golang.org/x/crypto/bcrypt
go get github.com/mattn/go-sqlite3
go get github.com/golang-jwt/jwt/v5
```

- [ ] **Step 2: Write the failing test for DB initialization**

```go
// internal/store/db_test.go
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

	// Check users table exists
	var name string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").Scan(&name)
	if err != nil {
		t.Fatalf("users table not found: %v", err)
	}

	// Check user_settings table exists
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").Scan(&name)
	if err != nil {
		t.Fatalf("user_settings table not found: %v", err)
	}

	// Check config table exists
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='config'").Scan(&name)
	if err != nil {
		t.Fatalf("config table not found: %v", err)
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
go test ./internal/store/ -v -run TestNewDB
```

Expected: FAIL — `NewDB` not defined.

- [ ] **Step 4: Implement DB initialization**

```go
// internal/store/db.go
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
go test ./internal/store/ -v -run TestNewDB
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add internal/store/db.go internal/store/db_test.go go.mod go.sum
git commit -m "feat: add SQLite database initialization with schema migrations"
```

---

## Task 2: User + UserSettings Models

**Files:**
- Create: `internal/model/user.go`

- [ ] **Step 1: Create User and UserSettings models**

```go
// internal/model/user.go
package model

import "time"

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type UserSettings struct {
	UserID               int64  `json:"userId"`
	Language             string `json:"language"`
	Theme                string `json:"theme"`
	QuadletDir           string `json:"quadletDir"`
	PodmanSocket         string `json:"podmanSocket"`
	ItemsPerPage         int    `json:"itemsPerPage"`
	AutoRefreshSeconds   int    `json:"autoRefreshSeconds"`
	DefaultRestartPolicy string `json:"defaultRestartPolicy"`
	NotifyOnFailure      bool   `json:"notifyOnFailure"`
}
```

- [ ] **Step 2: Verify compilation**

```bash
go build ./internal/model/
```

- [ ] **Step 3: Commit**

```bash
git add internal/model/user.go
git commit -m "feat: add User and UserSettings models"
```

---

## Task 3: User Store (CRUD)

**Files:**
- Create: `internal/store/user_store.go`
- Create: `internal/store/user_store_test.go`

- [ ] **Step 1: Write failing tests**

```go
// internal/store/user_store_test.go
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
	user, _ := us.GetByID(id)
	if user == nil {
		t.Fatal("user not found")
	}
	// Can't check password directly since it's in DB, but no error = pass
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
go test ./internal/store/ -v -run "UserStore"
```

Expected: FAIL — `NewUserStore` not defined.

- [ ] **Step 3: Implement UserStore**

```go
// internal/store/user_store.go
package store

import (
	"database/sql"
	"fmt"

	"github.com/choken/quadlet-manager/internal/model"
)

type UserStore struct {
	db *sql.DB
}

func NewUserStore(db *sql.DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) Create(username, passwordHash, role string) (int64, error) {
	res, err := s.db.Exec(
		"INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
		username, passwordHash, role,
	)
	if err != nil {
		return 0, fmt.Errorf("insert user: %w", err)
	}
	return res.LastInsertId()
}

func (s *UserStore) GetByID(id int64) (*model.User, error) {
	u := &model.User{}
	err := s.db.QueryRow(
		"SELECT id, username, role, created_at FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("user %d: %w", id, err)
	}
	return u, nil
}

func (s *UserStore) GetByUsername(username string) (*model.User, error) {
	u := &model.User{}
	err := s.db.QueryRow(
		"SELECT id, username, role, created_at FROM users WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("user %s: %w", username, err)
	}
	return u, nil
}

func (s *UserStore) GetPasswordHash(id int64) (string, error) {
	var hash string
	err := s.db.QueryRow("SELECT password FROM users WHERE id = ?", id).Scan(&hash)
	return hash, err
}

func (s *UserStore) GetPasswordHashByUsername(username string) (string, int64, error) {
	var hash string
	var id int64
	err := s.db.QueryRow("SELECT id, password FROM users WHERE username = ?", username).Scan(&id, &hash)
	return hash, id, err
}

func (s *UserStore) ListAll() ([]model.User, error) {
	rows, err := s.db.Query("SELECT id, username, role, created_at FROM users ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *UserStore) Delete(id int64) error {
	_, err := s.db.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

func (s *UserStore) HasAdmin() bool {
	var count int
	s.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
	return count > 0
}

func (s *UserStore) UpdateRole(id int64, role string) error {
	_, err := s.db.Exec("UPDATE users SET role = ? WHERE id = ?", role, id)
	return err
}

func (s *UserStore) UpdatePassword(id int64, passwordHash string) error {
	_, err := s.db.Exec("UPDATE users SET password = ? WHERE id = ?", passwordHash, id)
	return err
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
go test ./internal/store/ -v -run "UserStore"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/store/user_store.go internal/store/user_store_test.go
git commit -m "feat: add UserStore with CRUD and admin detection"
```

---

## Task 4: Settings Store

**Files:**
- Create: `internal/store/settings_store.go`
- Create: `internal/store/settings_store_test.go`

- [ ] **Step 1: Write failing tests**

```go
// internal/store/settings_store_test.go
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

	err := ss.Update(uid, map[string]interface{}{
		"language":     "zh",
		"theme":        "light",
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
go test ./internal/store/ -v -run "SettingsStore"
```

Expected: FAIL

- [ ] **Step 3: Implement SettingsStore**

```go
// internal/store/settings_store.go
package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
)

type SettingsStore struct {
	db *sql.DB
}

func NewSettingsStore(db *sql.DB) *SettingsStore {
	return &SettingsStore{db: db}
}

func (s *SettingsStore) GetByUserID(userID int64) (*model.UserSettings, error) {
	st := &model.UserSettings{}
	err := s.db.QueryRow(`SELECT user_id, language, theme, quadlet_dir, podman_socket,
		items_per_page, auto_refresh_seconds, default_restart_policy, notify_on_failure
		FROM user_settings WHERE user_id = ?`, userID).Scan(
		&st.UserID, &st.Language, &st.Theme, &st.QuadletDir, &st.PodmanSocket,
		&st.ItemsPerPage, &st.AutoRefreshSeconds, &st.DefaultRestartPolicy, &st.NotifyOnFailure,
	)
	if err == sql.ErrNoRows {
		// Create default settings
		_, err2 := s.db.Exec("INSERT INTO user_settings (user_id) VALUES (?)", userID)
		if err2 != nil {
			return nil, fmt.Errorf("create settings: %w", err2)
		}
		return s.GetByUserID(userID)
	}
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return st, nil
}

func (s *SettingsStore) Update(userID int64, fields map[string]interface{}) error {
	allowed := map[string]bool{
		"language": true, "theme": true, "quadlet_dir": true, "podman_socket": true,
		"items_per_page": true, "auto_refresh_seconds": true,
		"default_restart_policy": true, "notify_on_failure": true,
	}
	var sets []string
	var args []interface{}
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		sets = append(sets, k+" = ?")
		args = append(args, v)
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, userID)
	query := fmt.Sprintf("UPDATE user_settings SET %s WHERE user_id = ?", strings.Join(sets, ", "))
	_, err := s.db.Exec(query, args...)
	return err
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
go test ./internal/store/ -v -run "SettingsStore"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/store/settings_store.go internal/store/settings_store_test.go
git commit -m "feat: add SettingsStore with auto-create defaults and partial update"
```

---

## Task 5: JWT Helpers

**Files:**
- Create: `internal/auth/jwt.go`
- Create: `internal/auth/jwt_test.go`

- [ ] **Step 1: Write failing tests**

```go
// internal/auth/jwt_test.go
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
	if len(s1) != 32 {
		t.Errorf("expected 32 bytes, got %d", len(s1))
	}
	if string(s1) == string(s2) {
		t.Error("secrets should be unique")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
go test ./internal/auth/ -v
```

Expected: FAIL — package/auth functions not defined.

- [ ] **Step 3: Implement JWT helpers**

```go
// internal/auth/jwt.go
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func CreateToken(secret []byte, userID int64, username, role string, expiry time.Duration) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ValidateToken(secret []byte, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func GenerateSecret() ([]byte, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return []byte(hex.EncodeToString(b)), nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
go test ./internal/auth/ -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/auth/jwt.go internal/auth/jwt_test.go
git commit -m "feat: add JWT create/validate helpers with HS256 signing"
```

---

## Task 6: Auth Service

**Files:**
- Create: `internal/auth/service.go`
- Create: `internal/auth/service_test.go`

- [ ] **Step 1: Write failing tests**

```go
// internal/auth/service_test.go
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
go test ./internal/auth/ -v -run "Service"
```

Expected: FAIL

- [ ] **Step 3: Implement Auth Service**

```go
// internal/auth/service.go
package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/choken/quadlet-manager/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	users    *store.UserStore
	settings *store.SettingsStore
	secret   []byte
}

func NewService(db *sql.DB, jwtSecret []byte) *Service {
	return &Service{
		users:    store.NewUserStore(db),
		settings: store.NewSettingsStore(db),
		secret:   jwtSecret,
	}
}

func (s *Service) Register(username, password, role string) error {
	if username == "" || password == "" {
		return errors.New("username and password required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	_, err = s.users.Create(username, string(hash), role)
	return err
}

func (s *Service) Login(username, password string) (string, *User, error) {
	hash, userID, err := s.users.GetPasswordHashByUsername(username)
	if err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	user, err := s.users.GetByID(userID)
	if err != nil {
		return "", nil, err
	}
	token, err := CreateToken(s.secret, user.ID, user.Username, user.Role, 24*time.Hour)
	if err != nil {
		return "", nil, fmt.Errorf("create token: %w", err)
	}
	return token, &User{ID: user.ID, Username: user.Username, Role: user.Role}, nil
}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

func (s *Service) HasAdmin() bool {
	return s.users.HasAdmin()
}

func (s *Service) Users() *store.UserStore    { return s.users }
func (s *Service) Settings() *store.SettingsStore { return s.settings }
func (s *Service) Secret() []byte               { return s.secret }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
go test ./internal/auth/ -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/auth/service.go internal/auth/service_test.go
git commit -m "feat: add AuthService with bcrypt register/login"
```

---

## Task 7: JWT + RBAC Middleware

**Files:**
- Modify: `internal/middleware/auth.go`

- [ ] **Step 1: Write JWTAuth and RequireRole middleware**

```go
// internal/middleware/auth.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/gin-gonic/gin"
)

func JWTAuth(jwtSecret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ValidateToken(jwtSecret, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		for _, r := range roles {
			if role == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	}
}
```

- [ ] **Step 2: Verify compilation**

```bash
go build ./internal/middleware/
```

- [ ] **Step 3: Commit**

```bash
git add internal/middleware/auth.go
git commit -m "feat: add JWTAuth and RequireRole middleware"
```

---

## Task 8: Auth + Settings Handlers

**Files:**
- Create: `internal/handler/auth_handler.go`
- Create: `internal/handler/settings_handler.go`

- [ ] **Step 1: Implement AuthHandler**

```go
// internal/handler/auth_handler.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth *auth.Service
}

func NewAuthHandler(authSvc *auth.Service) *AuthHandler {
	return &AuthHandler{auth: authSvc}
}

func (h *AuthHandler) CheckInit(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"initialized": h.auth.HasAdmin()})
}

func (h *AuthHandler) InitAdmin(c *gin.Context) {
	if h.auth.HasAdmin() {
		c.JSON(http.StatusConflict, gin.H{"error": "already initialized"})
		return
	}
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.auth.Register(req.Username, req.Password, "admin"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	token, user, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token, user, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt64("user_id")
	user, err := h.auth.Users().GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	settings, _ := h.auth.Settings().GetByUserID(userID)
	c.JSON(http.StatusOK, gin.H{"user": user, "settings": settings})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}
	if req.Role != "admin" && req.Role != "user" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
		return
	}
	if err := h.auth.Register(req.Username, req.Password, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created"})
}

func (h *AuthHandler) ListUsers(c *gin.Context) {
	users, err := h.auth.Users().ListAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *AuthHandler) DeleteUser(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.auth.Users().Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *AuthHandler) UpdateUser(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Role     *string `json:"role"`
		Password *string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role != nil {
		if *req.Role != "admin" && *req.Role != "user" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
			return
		}
		h.auth.Users().UpdateRole(id, *req.Role)
	}
	if req.Password != nil {
		hash, _ := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		h.auth.Users().UpdatePassword(id, string(hash))
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}
```

- [ ] **Step 2: Implement SettingsHandler**

```go
// internal/handler/settings_handler.go
package handler

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	auth *auth.Service
}

func NewSettingsHandler(authSvc *auth.Service) *SettingsHandler {
	return &SettingsHandler{auth: authSvc}
}

func (h *SettingsHandler) GetSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")
	settings, err := h.auth.Settings().GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Validate quadlet_dir if provided
	if dir, ok := req["quadlet_dir"].(string); ok && dir != "" {
		if err := validateQuadletDir(dir); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quadlet_dir: " + err.Error()})
			return
		}
	}
	if err := h.auth.Settings().Update(userID, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func validateQuadletDir(path string) error {
	if !filepath.IsAbs(path) {
		return errors.New("must be absolute path")
	}
	clean := filepath.Clean(path)
	forbidden := []string{"/", "/bin", "/sbin", "/usr", "/etc", "/boot", "/sys", "/proc", "/dev", "/root"}
	for _, f := range forbidden {
		if clean == f {
			return errors.New("system directory not allowed")
		}
	}
	info, err := os.Stat(clean)
	if err != nil {
		return errors.New("directory does not exist")
	}
	if !info.IsDir() {
		return errors.New("not a directory")
	}
	return nil
}
```

- [ ] **Step 3: Fix imports in auth_handler.go** (add `bcrypt` import)

```go
import (
	// ... existing imports
	"golang.org/x/crypto/bcrypt"
)
```

- [ ] **Step 4: Verify compilation**

```bash
go build ./internal/handler/
```

- [ ] **Step 5: Commit**

```bash
git add internal/handler/auth_handler.go internal/handler/settings_handler.go
git commit -m "feat: add auth and settings handlers with path validation"
```

---

## Task 9: Wire into main.go

**Files:**
- Modify: `cmd/quadlet-manager/main.go`

- [ ] **Step 1: Add auth routes and JWT middleware to main.go**

Add to imports:
```go
"github.com/choken/quadlet-manager/internal/auth"
```

Add to config:
```go
type Config struct {
    // ... existing fields
    DBPath    string
    JWTSecret string
}
```

Add to main():
```go
// Initialize database
db, err := store.NewDB(cfg.DBPath)
if err != nil {
    log.Fatalf("database: %v", err)
}
defer db.Close()

// Initialize auth
jwtSecret := []byte(cfg.JWTSecret)
if len(jwtSecret) == 0 {
    jwtSecret, _ = auth.GenerateSecret()
}
authSvc := auth.NewService(db, jwtSecret)

// Initialize handlers
authH := handler.NewAuthHandler(authSvc)
settingsH := handler.NewSettingsHandler(authSvc)
```

Add routes:
```go
// Public auth routes
authGroup := r.Group("/api/v1/auth")
{
    authGroup.GET("/init", authH.CheckInit)
    authGroup.POST("/init", authH.InitAdmin)
    authGroup.POST("/login", authH.Login)
}

// Protected routes
protected := r.Group("/api/v1")
protected.Use(middleware.JWTAuth(jwtSecret))
{
    protected.GET("/auth/me", authH.Me)
    protected.GET("/settings", settingsH.GetSettings)
    protected.PUT("/settings", settingsH.UpdateSettings)

    // Admin only
    admin := protected.Group("/auth")
    admin.Use(middleware.RequireRole("admin"))
    {
        admin.POST("/register", authH.Register)
        admin.GET("/users", authH.ListUsers)
        admin.DELETE("/users/:id", authH.DeleteUser)
        admin.PUT("/users/:id", authH.UpdateUser)
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
go build ./internal/...
```

- [ ] **Step 3: Commit**

```bash
git add cmd/quadlet-manager/main.go
git commit -m "feat: wire auth system into main.go with JWT middleware"
```

---

## Task 10: Frontend Auth Store + API Client

**Files:**
- Create: `web/src/store/useAuth.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Create auth store**

```typescript
// web/src/store/useAuth.ts
import { create } from 'zustand'

interface User {
  id: number
  username: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  initialized: boolean | null
  loading: boolean
  error: string | null
  checkInit: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  initAdmin: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  initialized: null,
  loading: false,
  error: null,

  checkInit: async () => {
    try {
      const res = await fetch('/api/v1/auth/init')
      const data = await res.json()
      set({ initialized: data.initialized })
    } catch {
      set({ initialized: false })
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      localStorage.setItem('token', data.token)
      set({ token: data.token, user: data.user, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  initAdmin: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/v1/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) throw new Error('Init failed')
      const data = await res.json()
      localStorage.setItem('token', data.token)
      set({ token: data.token, user: data.user, initialized: true, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },

  fetchMe: async () => {
    const token = get().token
    if (!token) return
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        get().logout()
        return
      }
      const data = await res.json()
      set({ user: data.user })
    } catch {
      get().logout()
    }
  },
}))
```

- [ ] **Step 2: Update API client to include JWT header**

Modify `web/src/api/client.ts` — change the `request` function:

```typescript
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  })
  if (res.status === 401) {
    useAuth.getState().logout()
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}
```

Add import at top:
```typescript
import { useAuth } from '@/store/useAuth'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add web/src/store/useAuth.ts web/src/api/client.ts
git commit -m "feat: add auth store and JWT header in API client"
```

---

## Task 11: Login + Init Pages

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/InitPage.tsx`

- [ ] **Step 1: Create LoginPage**

```tsx
// web/src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/store/useAuth'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <h1 className="text-sm font-bold tracking-widest text-accent uppercase text-center">
          Quadlet Manager
        </h1>
        {error && (
          <div className="text-xs text-danger bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create InitPage**

```tsx
// web/src/pages/InitPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/store/useAuth'

export function InitPage() {
  const navigate = useNavigate()
  const { initAdmin, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return
    try {
      await initAdmin(username, password)
      navigate('/')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-sm font-bold tracking-widest text-accent uppercase">
            Quadlet Manager
          </h1>
          <p className="text-xs text-text-muted">Create your admin account</p>
        </div>
        {error && (
          <div className="text-xs text-danger bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || password !== confirm || password.length < 6}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Create Admin'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/LoginPage.tsx web/src/pages/InitPage.tsx
git commit -m "feat: add login and init pages"
```

---

## Task 12: Router Guards + Route Wiring

**Files:**
- Create: `web/src/components/AuthGuard.tsx`
- Modify: `web/src/router/index.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create AuthGuard component**

```tsx
// web/src/components/AuthGuard.tsx
import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/store/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, initialized, checkInit, fetchMe } = useAuth()

  useEffect(() => {
    if (initialized === null) checkInit()
    if (token) fetchMe()
  }, [initialized, token, checkInit, fetchMe])

  if (initialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size={24} />
      </div>
    )
  }

  if (!initialized) return <Navigate to="/init" replace />
  if (!token) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

- [ ] **Step 2: Update router with auth routes**

```tsx
// web/src/router/index.tsx
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/AuthGuard'
import { LoginPage } from '@/pages/LoginPage'
import { InitPage } from '@/pages/InitPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { ContainersPage } from '@/pages/ContainersPage'
import { ImagesPage } from '@/pages/ImagesPage'
import { VolumesPage } from '@/pages/VolumesPage'
import { NetworksPage } from '@/pages/NetworksPage'
import { FilesPage } from '@/pages/FilesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/init', element: <InitPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'containers', element: <ContainersPage /> },
      { path: 'images', element: <ImagesPage /> },
      { path: 'volumes', element: <VolumesPage /> },
      { path: 'networks', element: <NetworksPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

- [ ] **Step 3: Update App.tsx to check auth on load**

```tsx
// web/src/App.tsx
import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from '@/router'
import { useAuth } from '@/store/useAuth'
import { useApp } from '@/store/useApp'
import { useUnits } from '@/store/useUnits'
import { useContainers } from '@/store/useContainers'
import { useWebSocket } from '@/hooks/useWebSocket'

export default function App() {
  const { token, checkInit, fetchMe } = useAuth()
  const fetchSystemInfo = useApp((s) => s.fetchSystemInfo)
  const fetchUnits = useUnits((s) => s.fetchUnits)
  const fetchContainers = useContainers((s) => s.fetchContainers)

  useEffect(() => {
    checkInit()
  }, [checkInit])

  useEffect(() => {
    if (token) {
      fetchMe()
      fetchSystemInfo()
      fetchUnits()
      fetchContainers()
    }
  }, [token, fetchMe, fetchSystemInfo, fetchUnits, fetchContainers])

  useWebSocket((msg) => {
    if (msg.type === 'unit_status_changed' || msg.type === 'daemon_reloaded') {
      fetchUnits()
    }
    if (msg.type === 'stats_update') {
      fetchContainers()
    }
  })

  return <RouterProvider router={router} />
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AuthGuard.tsx web/src/router/index.tsx web/src/App.tsx
git commit -m "feat: add auth guard and route protection"
```

---

## Task 13: Admin Users Page

**Files:**
- Create: `web/src/pages/AdminUsersPage.tsx`

- [ ] **Step 1: Create AdminUsersPage**

```tsx
// web/src/pages/AdminUsersPage.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { useAuth } from '@/store/useAuth'
import { Trash2, UserPlus } from 'lucide-react'

interface User {
  id: number
  username: string
  role: string
  createdAt: string
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const currentUser = useAuth((s) => s.user)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await api.request<User[]>('/auth/users')
      setUsers(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAdd = async () => {
    try {
      await api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
      })
      setShowAdd(false)
      setNewUser({ username: '', password: '', role: 'user' })
      fetchUsers()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return
    try {
      await api.request(`/auth/users/${id}`, { method: 'DELETE' })
      fetchUsers()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          Users
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-accent hover:bg-accent-dim rounded transition-colors"
        >
          <UserPlus size={12} />
          Add User
        </button>
      </div>

      {showAdd && (
        <div className="border border-border rounded bg-surface p-3 space-y-2">
          <input
            type="text"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            placeholder="Username"
            className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Password"
            className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-accent text-background rounded text-xs hover:bg-accent/90 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-muted">Loading...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-surface-raised transition-colors">
                  <td className="px-3 py-2 text-text-primary">{u.username}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      u.role === 'admin' ? 'bg-accent-dim text-accent' : 'bg-surface-raised text-text-muted'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="p-1 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `request` export to api/client.ts**

Add to `web/src/api/client.ts`:
```typescript
export const api = {
  request,
  // ... existing methods
}
```

- [ ] **Step 3: Add sidebar link for admin users page**

In `AppSidebar.tsx`, add after the settings nav item:
```tsx
{currentUser?.role === 'admin' && (
  <NavLink to="/admin/users" ... >Users</NavLink>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/AdminUsersPage.tsx web/src/api/client.ts web/src/components/layout/AppSidebar.tsx
git commit -m "feat: add admin users management page"
```

---

## Task 14: Final Build + Verify

- [ ] **Step 1: Run all Go tests**

```bash
go test ./internal/...
```

Expected: all PASS

- [ ] **Step 2: Build frontend**

```bash
cd web && npm run build
```

Expected: exit 0

- [ ] **Step 3: Full build**

```bash
make build
```

Expected: binary in `bin/quadlet-manager`

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A && git commit -m "feat: auth system complete — SQLite, JWT, multi-user, settings"
```
