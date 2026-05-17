package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/choken/quadlet-manager/internal/middleware"
	"github.com/choken/quadlet-manager/internal/store"
	"github.com/gin-gonic/gin"
)

func setupAuthRouter(t *testing.T) (*gin.Engine, *auth.Service) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := store.NewDB(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	secret := []byte("test-secret-key-32-bytes-long!!")
	authSvc := auth.NewService(db, secret)
	authH := NewAuthHandler(authSvc)
	settingsH := NewSettingsHandler(authSvc)

	r := gin.New()

	// Public
	pub := r.Group("/api/v1/auth")
	pub.GET("/init", authH.CheckInit)
	pub.POST("/init", authH.InitAdmin)
	pub.POST("/login", authH.Login)

	// Protected
	p := r.Group("/api/v1")
	p.Use(middleware.JWTAuth(secret))
	{
		p.GET("/auth/me", authH.Me)
		p.GET("/settings", settingsH.GetSettings)
		p.PUT("/settings", settingsH.UpdateSettings)

		admin := p.Group("/auth")
		admin.Use(middleware.RequireRole("admin"))
		{
			admin.POST("/register", authH.Register)
			admin.GET("/users", authH.ListUsers)
			admin.DELETE("/users/:id", authH.DeleteUser)
			admin.PUT("/users/:id", authH.UpdateUser)
		}
	}

	return r, authSvc
}

func getToken(t *testing.T, r *gin.Engine, username, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	return resp["token"].(string)
}

// --- CheckInit ---

func TestAuthHandler_CheckInit_NoAdmin(t *testing.T) {
	r, _ := setupAuthRouter(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/init", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["initialized"] != false {
		t.Errorf("expected initialized=false, got %v", resp["initialized"])
	}
}

func TestAuthHandler_CheckInit_WithAdmin(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")

	req := httptest.NewRequest("GET", "/api/v1/auth/init", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["initialized"] != true {
		t.Errorf("expected initialized=true, got %v", resp["initialized"])
	}
}

// --- InitAdmin ---

func TestAuthHandler_InitAdmin_Success(t *testing.T) {
	r, _ := setupAuthRouter(t)
	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "password123"})
	req := httptest.NewRequest("POST", "/api/v1/auth/init", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["token"] == nil || resp["token"] == "" {
		t.Error("expected non-empty token")
	}
	user := resp["user"].(map[string]interface{})
	if user["username"] != "admin" {
		t.Errorf("expected admin, got %s", user["username"])
	}
	if user["role"] != "admin" {
		t.Errorf("expected admin role, got %s", user["role"])
	}
}

func TestAuthHandler_InitAdmin_AlreadyInitialized(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")

	body, _ := json.Marshal(map[string]string{"username": "admin2", "password": "pass"})
	req := httptest.NewRequest("POST", "/api/v1/auth/init", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

func TestAuthHandler_InitAdmin_MissingFields(t *testing.T) {
	r, _ := setupAuthRouter(t)
	body, _ := json.Marshal(map[string]string{"username": ""})
	req := httptest.NewRequest("POST", "/api/v1/auth/init", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Login ---

func TestAuthHandler_Login_Success(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("alice", "password123", "user")

	token := getToken(t, r, "alice", "password123")
	if token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestAuthHandler_Login_WrongPassword(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("bob", "correct", "user")

	body, _ := json.Marshal(map[string]string{"username": "bob", "password": "wrong"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestAuthHandler_Login_UnknownUser(t *testing.T) {
	r, _ := setupAuthRouter(t)

	body, _ := json.Marshal(map[string]string{"username": "nobody", "password": "pass"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

// --- Me ---

func TestAuthHandler_Me_Success(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("me_user", "pass", "user")
	token := getToken(t, r, "me_user", "pass")

	req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	user := resp["user"].(map[string]interface{})
	if user["username"] != "me_user" {
		t.Errorf("expected me_user, got %s", user["username"])
	}
	if resp["settings"] == nil {
		t.Error("expected settings in response")
	}
}

func TestAuthHandler_Me_NoToken(t *testing.T) {
	r, _ := setupAuthRouter(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

// --- Register ---

func TestAuthHandler_Register_AdminCanCreate(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	token := getToken(t, r, "admin", "pass")

	body, _ := json.Marshal(map[string]string{"username": "newuser", "password": "pass123", "role": "user"})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandler_Register_NonAdmin_Rejected(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	svc.Register("user1", "pass", "user")
	token := getToken(t, r, "user1", "pass")

	body, _ := json.Marshal(map[string]string{"username": "newuser", "password": "pass"})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestAuthHandler_Register_InvalidRole(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	token := getToken(t, r, "admin", "pass")

	body, _ := json.Marshal(map[string]string{"username": "u", "password": "p", "role": "superadmin"})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- ListUsers ---

func TestAuthHandler_ListUsers_Admin(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	svc.Register("u1", "pass", "user")
	svc.Register("u2", "pass", "user")
	token := getToken(t, r, "admin", "pass")

	req := httptest.NewRequest("GET", "/api/v1/auth/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var users []map[string]interface{}
	json.NewDecoder(w.Body).Decode(&users)
	if len(users) != 3 {
		t.Errorf("expected 3 users, got %d", len(users))
	}
}

// --- DeleteUser ---

func TestAuthHandler_DeleteUser_Admin(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	svc.Register("victim", "pass", "user")
	token := getToken(t, r, "admin", "pass")

	// Get victim ID
	users, _ := svc.Users().ListAll()
	var victimID int64
	for _, u := range users {
		if u.Username == "victim" {
			victimID = u.ID
		}
	}

	req := httptest.NewRequest("DELETE", "/api/v1/auth/users/"+fmt.Sprintf("%d", victimID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthHandler_DeleteUser_NonAdmin_Rejected(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	svc.Register("user1", "pass", "user")
	token := getToken(t, r, "user1", "pass")

	req := httptest.NewRequest("DELETE", "/api/v1/auth/users/1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

// --- UpdateUser ---

func TestAuthHandler_UpdateUser_Role(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("admin", "pass", "admin")
	svc.Register("u1", "pass", "user")
	token := getToken(t, r, "admin", "pass")

	users, _ := svc.Users().ListAll()
	var u1ID int64
	for _, u := range users {
		if u.Username == "u1" {
			u1ID = u.ID
		}
	}

	body, _ := json.Marshal(map[string]string{"role": "admin"})
	req := httptest.NewRequest("PUT", "/api/v1/auth/users/"+fmt.Sprintf("%d", u1ID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Verify role changed
	u, _ := svc.Users().GetByID(u1ID)
	if u.Role != "admin" {
		t.Errorf("expected admin, got %s", u.Role)
	}
}

// --- Settings ---

func TestSettingsHandler_GetSettings_Defaults(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("u", "pass", "user")
	token := getToken(t, r, "u", "pass")

	req := httptest.NewRequest("GET", "/api/v1/settings", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var settings map[string]interface{}
	json.NewDecoder(w.Body).Decode(&settings)
	if settings["language"] != "en" {
		t.Errorf("expected en, got %s", settings["language"])
	}
}

func TestSettingsHandler_UpdateSettings_Success(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("u", "pass", "user")
	token := getToken(t, r, "u", "pass")

	body, _ := json.Marshal(map[string]interface{}{"language": "zh", "theme": "light"})
	req := httptest.NewRequest("PUT", "/api/v1/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify
	req2 := httptest.NewRequest("GET", "/api/v1/settings", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	var settings map[string]interface{}
	json.NewDecoder(w2.Body).Decode(&settings)
	if settings["language"] != "zh" {
		t.Errorf("expected zh, got %s", settings["language"])
	}
}

func TestSettingsHandler_UpdateSettings_InvalidQuadletDir(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("u", "pass", "user")
	token := getToken(t, r, "u", "pass")

	body, _ := json.Marshal(map[string]interface{}{"quadlet_dir": "/etc"})
	req := httptest.NewRequest("PUT", "/api/v1/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for system dir, got %d", w.Code)
	}
}

func TestSettingsHandler_UpdateSettings_RelativePath(t *testing.T) {
	r, svc := setupAuthRouter(t)
	svc.Register("u", "pass", "user")
	token := getToken(t, r, "u", "pass")

	body, _ := json.Marshal(map[string]interface{}{"quadlet_dir": "relative/path"})
	req := httptest.NewRequest("PUT", "/api/v1/settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for relative path, got %d", w.Code)
	}
}
