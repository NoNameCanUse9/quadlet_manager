package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

func setupRouter(cfg config.Config) (*gin.Engine, *provider.MockSystemd, *provider.MockQuadletFS) {
	gin.SetMode(gin.TestMode)
	sd := provider.NewMockSystemd(cfg.Rootless)
	fs := provider.NewMockQuadletFS()
	hub := ws.NewHub()

	unitSvc := service.NewUnitService(sd, fs, nil, "")
	fileSvc := service.NewFileService(fs, sd, nil, "")

	systemH := NewSystemHandler(cfg, unitSvc)
	unitH := NewUnitHandler(unitSvc, hub)
	fileH := NewFileHandler(fileSvc)

	r := gin.New()
	api := r.Group("/api/v1")
	api.GET("/system/info", systemH.GetSystemInfo)
	api.GET("/units", unitH.ListUnits)
	api.POST("/units/:name/start", unitH.StartUnit)
	api.POST("/units/:name/stop", unitH.StopUnit)
	api.GET("/files", fileH.ListFiles)
	api.GET("/files/:filename", fileH.ReadFile)
	api.POST("/files", fileH.CreateFile)
	api.POST("/files/validate", fileH.ValidateFile)

	return r, sd, fs
}

func TestSystemHandler_GetSystemInfo(t *testing.T) {
	cfg := config.New(config.Options{Port: 9090})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var info map[string]interface{}
	json.NewDecoder(w.Body).Decode(&info)

	if info["port"].(float64) != 9090 {
		t.Errorf("expected port 9090, got %v", info["port"])
	}
	if info["quadletDir"] == nil || info["quadletDir"] == "" {
		t.Error("expected quadletDir to be set")
	}
}

func TestUnitHandler_ListUnits_Empty(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("GET", "/api/v1/units", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var units []model.UnitStatus
	json.NewDecoder(w.Body).Decode(&units)
	if len(units) != 0 {
		t.Errorf("expected 0 units, got %d", len(units))
	}
}

func TestUnitHandler_ListUnits_WithData(t *testing.T) {
	cfg := config.New(config.Options{})
	r, sd, fs := setupRouter(cfg)
	fs.Files["nginx.container"] = "[Container]\nImage=nginx\n"
	sd.Units["nginx.service"] = model.UnitStatus{
		Name: "nginx.service", ActiveState: "active",
	}

	req := httptest.NewRequest("GET", "/api/v1/units", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var units []model.UnitStatus
	json.NewDecoder(w.Body).Decode(&units)
	if len(units) != 1 {
		t.Fatalf("expected 1 unit, got %d", len(units))
	}
	if units[0].Name != "nginx.service" {
		t.Errorf("expected nginx.service, got %s", units[0].Name)
	}
}

func TestUnitHandler_StartUnit(t *testing.T) {
	cfg := config.New(config.Options{})
	r, sd, _ := setupRouter(cfg)
	sd.Units["nginx.service"] = model.UnitStatus{
		Name: "nginx.service", ActiveState: "inactive", SubState: "dead",
	}

	req := httptest.NewRequest("POST", "/api/v1/units/nginx.service/start", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	u := sd.Units["nginx.service"]
	if u.ActiveState != "active" {
		t.Errorf("expected active after start, got %s", u.ActiveState)
	}
}

func TestUnitHandler_StopUnit(t *testing.T) {
	cfg := config.New(config.Options{})
	r, sd, _ := setupRouter(cfg)
	sd.Units["nginx.service"] = model.UnitStatus{
		Name: "nginx.service", ActiveState: "active", SubState: "running",
	}

	req := httptest.NewRequest("POST", "/api/v1/units/nginx.service/stop", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	u := sd.Units["nginx.service"]
	if u.ActiveState != "inactive" {
		t.Errorf("expected inactive after stop, got %s", u.ActiveState)
	}
}

func TestFileHandler_ListFiles(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, fs := setupRouter(cfg)
	fs.Files["nginx.container"] = "[Container]\nImage=nginx\n"

	req := httptest.NewRequest("GET", "/api/v1/files", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var files []map[string]interface{}
	json.NewDecoder(w.Body).Decode(&files)
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
}

func TestFileHandler_ReadFile(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, fs := setupRouter(cfg)
	fs.Files["nginx.container"] = "[Container]\nImage=nginx\n"

	req := httptest.NewRequest("GET", "/api/v1/files/nginx.container", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["content"] == nil {
		t.Error("expected content in response")
	}
}

func TestFileHandler_ValidateFile_Valid(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	body := `{"content":"[Container]\nImage=nginx:latest\n"}`
	req := httptest.NewRequest("POST", "/api/v1/files/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["valid"] != true {
		t.Errorf("expected valid=true, got %v", resp["valid"])
	}
}

func TestFileHandler_ValidateFile_Empty(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	body := `{"content":""}`
	req := httptest.NewRequest("POST", "/api/v1/files/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty content, got %d", w.Code)
	}
}

// --- RED tests: these expose missing handler behavior ---

func TestFileHandler_ReadFile_NotFound(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("GET", "/api/v1/files/nonexistent.container", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for nonexistent file, got %d", w.Code)
	}
}

func TestFileHandler_CreateFile_TraversalAttack(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	body := `{"filename":"../../etc/passwd","content":"evil"}`
	req := httptest.NewRequest("POST", "/api/v1/files", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for traversal attack, got %d", w.Code)
	}
}

func TestFileHandler_CreateFile_InvalidBody(t *testing.T) {
	cfg := config.New(config.Options{})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("POST", "/api/v1/files", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", w.Code)
	}
}
