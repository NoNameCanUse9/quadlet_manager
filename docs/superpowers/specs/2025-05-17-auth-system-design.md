# Auth System Design Spec

> Date: 2025-05-17
> Status: Approved
> Scope: Multi-user authentication, JWT, user settings, SQLite storage

---

## 1. Overview

Add multi-user authentication and per-user settings to Quadlet Manager. Uses SQLite3 for storage, bcrypt for password hashing, JWT for API authentication.

**Core principles:**
- `.container` / `.volume` / `.network` files are the source of truth. Database stores only UI preferences.
- `user_settings.quadlet_dir` is a scan path preference, not a config store.
- Path validation on `quadlet_dir` prevents users from pointing at system directories.

---

## 2. Data Model

### SQLite Schema

```sql
CREATE TABLE users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,           -- bcrypt hash (salt embedded by bcrypt)
    role       TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
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
```

### Go Models

```go
// internal/model/user.go
type User struct {
    ID        int64     `json:"id"`
    Username  string    `json:"username"`
    Role      string    `json:"role"`       // "admin" | "user"
    CreatedAt time.Time `json:"createdAt"`
}

type UserSettings struct {
    UserID              int64  `json:"userId"`
    Language            string `json:"language"`
    Theme               string `json:"theme"`
    QuadletDir          string `json:"quadletDir"`
    PodmanSocket        string `json:"podmanSocket"`
    ItemsPerPage        int    `json:"itemsPerPage"`
    AutoRefreshSeconds  int    `json:"autoRefreshSeconds"`
    DefaultRestartPolicy string `json:"defaultRestartPolicy"`
    NotifyOnFailure     bool   `json:"notifyOnFailure"`
}
```

---

## 3. Authentication Flow

```
Browser loads app
    │
    ▼
GET /api/v1/auth/init  ──── Has admin user? ──┬── No  → Show Init Wizard
                                               └── Yes → Show Login Page
    │
    ▼
POST /api/v1/auth/init   (create first admin)
POST /api/v1/auth/login  (get JWT token)
    │
    ▼
Store JWT in localStorage
    │
    ▼
Every API request: Authorization: Bearer <token>
    │
    ▼
JWT Middleware validates → injects user_id + role into Gin context
    │
    ▼
Handler reads user_id/role from context
```

### JWT Payload

```json
{
  "user_id": 1,
  "username": "admin",
  "role": "admin",
  "exp": 1716000000
}
```

- Token expiry: 24 hours (configurable via `--jwt-expiry` flag)
- Secret: auto-generated on first run, stored in SQLite `config` table, or via `--jwt-secret` flag

---

## 4. API Endpoints

### Public (no auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/auth/init` | Check if system initialized (has admin user). Returns `{ "initialized": bool }` |
| `POST` | `/api/v1/auth/init` | Create first admin. Body: `{ "username", "password" }`. Returns JWT |
| `POST` | `/api/v1/auth/login` | Login. Body: `{ "username", "password" }`. Returns `{ "token", "user" }` |

### Authenticated (any role)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/auth/me` | Current user info + settings |
| `PUT` | `/api/v1/settings` | Update own settings |
| `GET` | `/api/v1/settings` | Get own settings |

### Admin only

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create user. Body: `{ "username", "password", "role" }` |
| `GET` | `/api/v1/auth/users` | List all users |
| `DELETE` | `/api/v1/auth/users/:id` | Delete user |
| `PUT` | `/api/v1/auth/users/:id` | Update user (role, password) |

---

## 5. Middleware

### JWTAuth Middleware

```go
func JWTAuth(jwtSecret []byte) gin.HandlerFunc {
    return func(c *gin.Context) {
        header := c.GetHeader("Authorization")
        if !strings.HasPrefix(header, "Bearer ") {
            c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
            return
        }
        token := strings.TrimPrefix(header, "Bearer ")
        claims, err := validateJWT(token, jwtSecret)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }
        c.Set("user_id", claims.UserID)
        c.Set("username", claims.Username)
        c.Set("role", claims.Role)
        c.Next()
    }
}
```

### RequireRole Middleware

```go
func RequireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        role := c.GetString("role")
        for _, r := range roles {
            if role == r {
                c.Next()
                return
            }
        }
        c.AbortWithStatusJSON(403, gin.H{"error": "forbidden"})
    }
}
```

---

## 6. Security

### Password Hashing

Use `golang.org/x/crypto/bcrypt` with `bcrypt.DefaultCost` (10). bcrypt handles salt generation internally.

```go
hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
err := bcrypt.CompareHashAndPassword(hash, []byte(input))
```

### Path Validation (quadlet_dir)

On `PUT /api/v1/settings`, validate `quadlet_dir` before saving:

```go
func validateQuadletDir(path string) error {
    if path == "" {
        return nil // empty = use default
    }
    if !filepath.IsAbs(path) {
        return errors.New("must be absolute path")
    }
    clean := filepath.Clean(path)
    // Block system directories
    forbidden := []string{
        "/", "/bin", "/sbin", "/usr", "/etc",
        "/boot", "/sys", "/proc", "/dev", "/root",
    }
    for _, f := range forbidden {
        if clean == f {
            return errors.New("system directory not allowed")
        }
    }
    // Must exist and be a directory
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

### JWT Secret Management

- Auto-generate 32-byte random secret on first run
- Store in SQLite `config` table: `key='jwt_secret', value='<hex>'`
- Override via `--jwt-secret` CLI flag (for multi-instance deployments)
- Never log or expose the secret

---

## 7. Frontend

### New Pages

**LoginPage** — username/password form, redirects to dashboard on success

**InitPage** — shown on first access when no admin exists:
1. Welcome message
2. Create admin username + password
3. Submit → auto-login → redirect to dashboard

**SettingsPage** — extend existing:
- Language, Theme (existing)
- Quadlet Directory (with path validation feedback)
- Podman Socket
- Items per page
- Auto-refresh interval
- Default restart policy
- Notify on failure toggle

**AdminUsersPage** — admin only:
- User list (username, role, created_at)
- Add user button
- Delete user button
- Role change dropdown

### Auth State (Zustand)

```typescript
interface AuthState {
  token: string | null
  user: User | null
  initialized: boolean | null  // null = loading
  login: (username: string, password: string) => Promise<void>
  initAdmin: (username: string, password: string) => Promise<void>
  logout: () => void
  checkInit: () => Promise<void>
}
```

### API Client Changes

Add JWT token to all requests:

```typescript
const token = useAuth.getState().token
headers: {
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : '',
}
```

### Router Guards

```
/ → check auth
  ├─ not initialized → /init
  ├─ not logged in → /login
  └─ logged in → render AppLayout
```

---

## 8. Implementation Packages

| Package | Responsibility |
|---|---|
| `internal/auth/service.go` | Register, Login, ValidateToken, JWT generation |
| `internal/auth/jwt.go` | JWT create/validate helpers |
| `internal/middleware/auth.go` | JWTAuth, RequireRole middleware |
| `internal/handler/auth_handler.go` | Auth REST handlers |
| `internal/handler/settings_handler.go` | Settings REST handlers |
| `internal/store/user_store.go` | SQLite user CRUD |
| `internal/store/settings_store.go` | SQLite settings CRUD |
| `internal/store/db.go` | SQLite connection + migrations |
| `web/src/pages/LoginPage.tsx` | Login form |
| `web/src/pages/InitPage.tsx` | First-run wizard |
| `web/src/pages/AdminUsersPage.tsx` | User management |
| `web/src/store/useAuth.ts` | Auth state |

---

## 9. Dependencies

```
go get golang.org/x/crypto/bcrypt
go get github.com/mattn/go-sqlite3
go get github.com/golang-jwt/jwt/v5
```

Frontend: no new dependencies (use existing fetch + zustand).

---

## 10. Migration Strategy

SQLite database created on first startup at `~/.config/quadlet-manager/data.db` (rootless) or `/var/lib/quadlet-manager/data.db` (rootful). Schema applied via embedded SQL migration. No external migration tool needed.
