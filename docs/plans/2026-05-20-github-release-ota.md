# GitHub Release OTA Update Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add version tracking, GitHub Release update checking, and frontend notification to Quadlet Manager.

**Architecture:** Backend goroutine periodically calls GitHub Releases API, caches result in memory. Frontend polls backend for update info. Version injected at build time via ldflags. GitHub Actions automates multi-arch binary releases.

**Tech Stack:** Go `golang.org/x/mod/semver`, `net/http`, React TanStack Query, shadcn/ui Popover, GitHub Actions

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `internal/version/version.go` | Create | Version variable (ldflags target) |
| `internal/updater/checker.go` | Create | GitHub Release checker + semver compare |
| `internal/updater/checker_test.go` | Create | Checker unit tests with mock HTTP server |
| `internal/handler/system_handler.go` | Modify | Add version to SystemInfo, add update handler methods |
| `internal/handler/handler_test.go` | Modify | Add update endpoint tests |
| `cmd/quadlet-manager/main.go` | Modify | Init Checker, register routes |
| `Makefile` | Modify | Add ldflags version injection |
| `web/src/api/client.ts` | Modify | Add UpdateInfo type + API methods |
| `web/src/i18n/en.json` | Modify | Add update-related translations |
| `web/src/i18n/zh.json` | Modify | Add update-related translations |
| `web/src/components/layout/AppHeader.tsx` | Modify | Add update notification badge |
| `web/src/pages/SettingsPage.tsx` | Modify | Add "About" section |
| `.github/workflows/release.yml` | Create | Release CI/CD |
| `.github/workflows/ci.yml` | Create | PR/push CI |

---

### Task 1: Version System

**Files:**
- Create: `internal/version/version.go`
- Modify: `Makefile:1-8`

- [ ] **Step 1: Create version package**

```go
// internal/version/version.go
package version

// Version is set at build time via ldflags.
// Default "dev" indicates a development build.
var Version = "dev"
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./internal/version/`
Expected: no output (success)

- [ ] **Step 3: Update Makefile with ldflags**

Replace the `build` target in `Makefile` (lines 4-8):

```makefile
VERSION := $(shell git describe --tags --always --dirty)

# Build frontend and embed in Go binary
build: frontend
	mkdir -p cmd/quadlet-manager/web
	cp -r web/dist cmd/quadlet-manager/web/
	go build -ldflags "-s -w -X github.com/choken/quadlet-manager/internal/version.Version=$(VERSION)" \
		-o bin/quadlet-manager ./cmd/quadlet-manager
	rm -rf cmd/quadlet-manager/web
```

- [ ] **Step 4: Commit**

```bash
git add internal/version/version.go Makefile
git commit -m "feat: add version system with ldflags injection"
```

---

### Task 2: Update Checker Core (TDD)

**Files:**
- Create: `internal/updater/checker.go`
- Create: `internal/updater/checker_test.go`

- [ ] **Step 1: Add semver dependency**

Run: `go get golang.org/x/mod/semver`
Expected: go.mod updated with `golang.org/x/mod`

- [ ] **Step 2: Write failing tests for version comparison**

```go
// internal/updater/checker_test.go
package updater

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions_DevAlwaysHasUpdate(t *testing.T) {
	info := &UpdateInfo{Current: "dev", Latest: "v1.0.0"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("dev version should always have update")
	}
}

func TestCompareVersions_SemverNewer(t *testing.T) {
	info := &UpdateInfo{Current: "v1.0.0", Latest: "v1.1.0"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("v1.1.0 > v1.0.0 should have update")
	}
}

func TestCompareVersions_SemverSame(t *testing.T) {
	info := &UpdateInfo{Current: "v1.0.0", Latest: "v1.0.0"}
	compareVersions(info)
	if info.HasUpdate {
		t.Error("same version should not have update")
	}
}

func TestCompareVersions_SemverOlder(t *testing.T) {
	info := &UpdateInfo{Current: "v2.0.0", Latest: "v1.0.0"}
	compareVersions(info)
	if info.HasUpdate {
		t.Error("current newer than latest should not have update")
	}
}

func TestCompareVersions_InvalidSemver_Fallback(t *testing.T) {
	info := &UpdateInfo{Current: "abc", Latest: "def"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("different non-semver strings should have update")
	}
	info2 := &UpdateInfo{Current: "abc", Latest: "abc"}
	compareVersions(info2)
	if info2.HasUpdate {
		t.Error("same non-semver strings should not have update")
	}
}

func TestCompareVersions_DirtyGitDescribe(t *testing.T) {
	info := &UpdateInfo{Current: "v1.2.3-5-gabcdef", Latest: "v1.2.3"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("dirty git describe vs release should have update")
	}
}

func TestChecker_Check_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/test/repo/releases/latest" {
			w.WriteHeader(404)
			return
		}
		json.NewEncoder(w).Encode(githubRelease{
			TagName:     "v1.2.0",
			HTMLURL:     "https://github.com/test/repo/releases/tag/v1.2.0",
			Body:        "## Changes\n- new feature",
			PublishedAt: "2026-05-20T10:00:00Z",
		})
	}))
	defer srv.Close()

	c := &Checker{
		currentVersion: "v1.0.0",
		githubRepo:     "test/repo",
		checkInterval:  24 * time.Hour,
		httpClient:     srv.Client(),
		baseURL:        srv.URL + "/repos",
	}

	info, err := c.Check(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.HasUpdate {
		t.Error("expected HasUpdate=true")
	}
	if info.Latest != "v1.2.0" {
		t.Errorf("expected latest v1.2.0, got %s", info.Latest)
	}
	if info.Current != "v1.0.0" {
		t.Errorf("expected current v1.0.0, got %s", info.Current)
	}
}

func TestChecker_Check_NetworkError(t *testing.T) {
	c := &Checker{
		currentVersion: "v1.0.0",
		githubRepo:     "test/repo",
		checkInterval:  24 * time.Hour,
		httpClient:     &http.Client{Transport: &badTransport{}},
		baseURL:        "http://invalid.invalid/repos",
	}

	info, err := c.Check(context.Background())
	if err == nil {
		t.Error("expected error for network failure")
	}
	if info != nil {
		t.Error("expected nil info on error")
	}
}

func TestChecker_GetCached(t *testing.T) {
	c := NewChecker("v1.0.0", "test/repo")
	if c.GetCached() != nil {
		t.Error("expected nil cached before first check")
	}
}

type badTransport struct{}

func (t *badTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, &net.OpError{Err: fmt.Errorf("simulated network error")}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `go test ./internal/updater/ -v`
Expected: FAIL — package doesn't exist yet

- [ ] **Step 4: Implement checker**

```go
// internal/updater/checker.go
package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"golang.org/x/mod/semver"
)

// UpdateInfo holds the result of an update check.
type UpdateInfo struct {
	Current     string `json:"current"`
	Latest      string `json:"latest"`
	HasUpdate   bool   `json:"hasUpdate"`
	ReleaseURL  string `json:"releaseUrl"`
	ReleaseNote string `json:"releaseNote"`
	PublishedAt string `json:"publishedAt"`
	CheckedAt   string `json:"checkedAt"`
}

// githubRelease is the GitHub API response subset we need.
type githubRelease struct {
	TagName     string `json:"tag_name"`
	HTMLURL     string `json:"html_url"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
}

// Checker periodically checks GitHub for new releases.
type Checker struct {
	currentVersion string
	githubRepo     string
	mu             sync.RWMutex
	cached         *UpdateInfo
	checkInterval  time.Duration
	httpClient     *http.Client
	baseURL        string // overridable for testing
}

// NewChecker creates a new update checker.
// githubRepo is "owner/repo" (e.g. "choken/quadlet-manager").
func NewChecker(currentVersion, githubRepo string) *Checker {
	return &Checker{
		currentVersion: currentVersion,
		githubRepo:     githubRepo,
		checkInterval:  24 * time.Hour,
		httpClient:     &http.Client{Timeout: 10 * time.Second},
		baseURL:        "https://api.github.com/repos",
	}
}

// Check calls GitHub API and returns update info.
func (c *Checker) Check(ctx context.Context) (*UpdateInfo, error) {
	url := fmt.Sprintf("%s/%s/releases/latest", c.baseURL, c.githubRepo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "quadlet-manager/"+c.currentVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api status %d", resp.StatusCode)
	}

	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	info := &UpdateInfo{
		Current:     c.currentVersion,
		Latest:      rel.TagName,
		ReleaseURL:  rel.HTMLURL,
		ReleaseNote: rel.Body,
		PublishedAt: rel.PublishedAt,
		CheckedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	compareVersions(info)

	c.mu.Lock()
	c.cached = info
	c.mu.Unlock()

	return info, nil
}

// GetCached returns the last check result, or nil if never checked.
func (c *Checker) GetCached() *UpdateInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cached
}

// StartPeriodicCheck starts a background goroutine that checks every checkInterval.
func (c *Checker) StartPeriodicCheck(ctx context.Context) {
	go func() {
		// Initial check on startup
		if _, err := c.Check(ctx); err != nil {
			log.Printf("updater: initial check failed: %v", err)
		}
		ticker := time.NewTicker(c.checkInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := c.Check(ctx); err != nil {
					log.Printf("updater: check failed: %v", err)
				}
			}
		}
	}()
}

// compareVersions sets HasUpdate based on semver comparison.
// Falls back to string inequality for non-semver versions.
func compareVersions(info *UpdateInfo) {
	current := ensureV(info.Current)
	latest := ensureV(info.Latest)

	if info.Current == "dev" {
		info.HasUpdate = true
		return
	}

	if semver.IsValid(current) && semver.IsValid(latest) {
		info.HasUpdate = semver.Compare(latest, current) > 0
		return
	}

	// Fallback: different string = has update
	info.HasUpdate = current != latest
}

// ensureV adds "v" prefix if missing (required by semver.IsValid).
func ensureV(v string) string {
	if len(v) > 0 && v[0] != 'v' {
		return "v" + v
	}
	return v
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `go test ./internal/updater/ -v`
Expected: all 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add internal/updater/ go.mod go.sum
git commit -m "feat(updater): add GitHub Release checker with semver comparison"
```

---

### Task 3: Backend Handler & Routes

**Files:**
- Modify: `internal/handler/system_handler.go:1-33`
- Modify: `internal/handler/handler_test.go:18-43`
- Modify: `cmd/quadlet-manager/main.go:1-10,97-100,140-155,188-189`

- [ ] **Step 1: Add update handler methods to SystemHandler**

Edit `internal/handler/system_handler.go` — replace the entire file:

```go
package handler

import (
	"context"
	"net/http"

	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/updater"
	"github.com/choken/quadlet-manager/internal/version"
	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	cfg     config.Config
	units   *service.UnitService
	checker *updater.Checker
}

func NewSystemHandler(cfg config.Config, units *service.UnitService) *SystemHandler {
	return &SystemHandler{cfg: cfg, units: units}
}

func (h *SystemHandler) SetChecker(c *updater.Checker) {
	h.checker = c
}

type SystemInfo struct {
	Port       int    `json:"port"`
	Rootless   bool   `json:"rootless"`
	QuadletDir string `json:"quadletDir"`
	Version    string `json:"version"`
}

func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, SystemInfo{
		Port:       h.cfg.Port,
		Rootless:   h.cfg.Rootless,
		QuadletDir: h.cfg.QuadletDir,
		Version:    version.Version,
	})
}

// GetUpdateInfo returns the cached update check result.
func (h *SystemHandler) GetUpdateInfo(c *gin.Context) {
	if h.checker == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "updater not configured"})
		return
	}
	info := h.checker.GetCached()
	if info == nil {
		// Never checked yet — return no-update placeholder
		c.JSON(http.StatusOK, updater.UpdateInfo{
			Current:   version.Version,
			HasUpdate: false,
		})
		return
	}
	c.JSON(http.StatusOK, info)
}

// CheckUpdate triggers an immediate update check.
func (h *SystemHandler) CheckUpdate(c *gin.Context) {
	if h.checker == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "updater not configured"})
		return
	}
	info, err := h.checker.Check(context.Background())
	if err != nil {
		// Return cached if available, otherwise error
		cached := h.checker.GetCached()
		if cached != nil {
			c.JSON(http.StatusOK, cached)
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
```

- [ ] **Step 2: Add update handler tests**

Append to `internal/handler/handler_test.go`:

```go
func TestSystemHandler_GetUpdateInfo_NoChecker(t *testing.T) {
	cfg := config.New(config.Options{Port: 9090})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("GET", "/api/v1/system/update", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestSystemHandler_GetSystemInfo_HasVersion(t *testing.T) {
	cfg := config.New(config.Options{Port: 9090})
	r, _, _ := setupRouter(cfg)

	req := httptest.NewRequest("GET", "/api/v1/system/info", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var info map[string]interface{}
	json.NewDecoder(w.Body).Decode(&info)

	if _, ok := info["version"]; !ok {
		t.Error("expected 'version' field in system info")
	}
}
```

Also update the `setupRouter` function to register the update routes:

```go
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
	api.GET("/system/update", systemH.GetUpdateInfo)
	api.POST("/system/update/check", systemH.CheckUpdate)
	api.GET("/units", unitH.ListUnits)
	api.POST("/units/:name/start", unitH.StartUnit)
	api.POST("/units/:name/stop", unitH.StopUnit)
	api.GET("/files", fileH.ListFiles)
	api.GET("/files/:filename", fileH.ReadFile)
	api.POST("/files", fileH.CreateFile)
	api.POST("/files/validate", fileH.ValidateFile)

	return r, sd, fs
}
```

- [ ] **Step 3: Run handler tests**

Run: `go test ./internal/handler/ -v`
Expected: all tests PASS (including new update tests)

- [ ] **Step 4: Wire checker into main.go**

Edit `cmd/quadlet-manager/main.go`:

1. Add imports (after existing imports around line 5-10):

```go
web "github.com/choken/quadlet-manager"
"github.com/choken/quadlet-manager/internal/auth"
"github.com/choken/quadlet-manager/internal/config"
"github.com/choken/quadlet-manager/internal/handler"
"github.com/choken/quadlet-manager/internal/middleware"
"github.com/choken/quadlet-manager/internal/provider"
"github.com/choken/quadlet-manager/internal/service"
"github.com/choken/quadlet-manager/internal/store"
"github.com/choken/quadlet-manager/internal/updater"
"github.com/choken/quadlet-manager/internal/version"
"github.com/choken/quadlet-manager/internal/ws"
```

2. After `composeH := handler.NewComposeHandler(composeProvider)` (line 154), add:

```go
	// Initialize update checker
	updateChecker := updater.NewChecker(version.Version, "choken/quadlet-manager")
	updateChecker.StartPeriodicCheck(context.Background())
```

3. After `systemH := handler.NewSystemHandler(cfg, unitSvc)` (line 141), add:

```go
	systemH.SetChecker(updateChecker)
```

4. In the protected routes section (after line 189 `protected.GET("/system/info", systemH.GetSystemInfo)`), add:

```go
		protected.GET("/system/update", systemH.GetUpdateInfo)
		protected.POST("/system/update/check", systemH.CheckUpdate)
```

- [ ] **Step 5: Run all backend tests**

Run: `go test ./internal/...`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add internal/handler/system_handler.go internal/handler/handler_test.go cmd/quadlet-manager/main.go
git commit -m "feat: integrate update checker with API endpoints"
```

---

### Task 4: Frontend API Client & i18n

**Files:**
- Modify: `web/src/api/client.ts:26-31,147-151`
- Modify: `web/src/i18n/en.json`
- Modify: `web/src/i18n/zh.json`

- [ ] **Step 1: Add UpdateInfo type and API methods to client.ts**

Add `UpdateInfo` interface after the existing `SystemInfo` interface (after line 151):

```typescript
export interface UpdateInfo {
  current: string
  latest: string
  hasUpdate: boolean
  releaseUrl: string
  releaseNote: string
  publishedAt: string
  checkedAt: string
}
```

Update `SystemInfo` to include `version`:

```typescript
export interface SystemInfo {
  port: number
  rootless: boolean
  quadletDir: string
  version: string
}
```

Add update API methods after `getSystemInfo` (after line 29):

```typescript
  // Update
  getUpdateInfo: () => request<UpdateInfo>('/system/update'),
  checkUpdate: () => request<UpdateInfo>('/system/update/check', { method: 'POST' }),
```

- [ ] **Step 2: Add i18n translations**

Read the full en.json and zh.json files first, then add the `settings.about` and `header.updateAvailable` keys.

For `web/src/i18n/en.json`, add inside the `settings` object:

```json
    "about": {
      "title": "About",
      "currentVersion": "Current Version",
      "latestVersion": "Latest Version",
      "hasUpdate": "Update available",
      "noUpdate": "Up to date",
      "checkUpdate": "Check for Updates",
      "goToDownload": "Go to Download",
      "lastChecked": "Last Checked",
      "releaseNotes": "Release Notes"
    }
```

Add inside the `header` object:

```json
    "updateAvailable": "Update available"
```

For `web/src/i18n/zh.json`, add inside the `settings` object:

```json
    "about": {
      "title": "关于",
      "currentVersion": "当前版本",
      "latestVersion": "最新版本",
      "hasUpdate": "有新版本可用",
      "noUpdate": "已是最新版本",
      "checkUpdate": "检查更新",
      "goToDownload": "前往下载",
      "lastChecked": "上次检查",
      "releaseNotes": "更新日志"
    }
```

Add inside the `header` object:

```json
    "updateAvailable": "有新版本"
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/src/api/client.ts web/src/i18n/en.json web/src/i18n/zh.json
git commit -m "feat(frontend): add update API client and i18n translations"
```

---

### Task 5: AppHeader Update Notification

**Files:**
- Modify: `web/src/components/layout/AppHeader.tsx`

- [ ] **Step 1: Add update notification badge to AppHeader**

Replace the entire `AppHeader` component in `web/src/components/layout/AppHeader.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useUnits } from '@/store/useUnits'
import { useApp } from '@/store/useApp'
import { cn } from '@/lib/utils'
import { api, type UpdateInfo } from '@/api/client'
import { Play, Square, RotateCcw, RefreshCw, Languages, ArrowUpCircle } from 'lucide-react'
import i18n from '@/i18n'
import { useState, useRef, useEffect } from 'react'

export function AppHeader() {
  const { t } = useTranslation()
  const selectedFile = useApp((s) => s.selectedFile)
  const { daemonReload } = useUnits()
  const [showUpdate, setShowUpdate] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data: updateInfo } = useQuery<UpdateInfo>({
    queryKey: ['update-info'],
    queryFn: api.getUpdateInfo,
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    retry: false,
  })

  const hasUpdate = updateInfo?.hasUpdate ?? false

  // Close popover on outside click
  useEffect(() => {
    if (!showUpdate) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowUpdate(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUpdate])

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 flex-shrink-0 transition-all duration-200">
      {/* Service Control Section */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase">
          {t('header.serviceControl')}
        </span>
        {selectedFile && (
          <span className="text-sm text-accent font-semibold truncate max-w-64 bg-accent/5 border border-accent/20 rounded px-2.5 py-0.5 font-mono">
            {selectedFile}
          </span>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5">
        <HeaderButton
          icon={Play}
          label={t('header.start')}
          color="text-accent hover:bg-accent-dim hover:text-accent"
        />
        <HeaderButton
          icon={Square}
          label={t('header.stop')}
          color="text-danger hover:bg-red-500/10 hover:text-red-400"
        />
        <HeaderButton
          icon={RotateCcw}
          label={t('header.restart')}
          color="text-info hover:bg-blue-500/10 hover:text-blue-400"
        />
        <HeaderButton
          icon={RefreshCw}
          label={t('header.daemonReload')}
          color="text-warning hover:bg-purple-500/10 hover:text-yellow-400"
          onClick={daemonReload}
        />

        <div className="w-px h-5 bg-border mx-3.5" />

        {/* Update Notification */}
        {hasUpdate && (
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowUpdate(!showUpdate)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 rounded transition-all"
              title={t('header.updateAvailable')}
            >
              <ArrowUpCircle size={14} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
            </button>
            {showUpdate && updateInfo && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface-raised border border-border rounded-lg shadow-lg p-4 z-50">
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {t('settings.about.hasUpdate')}
                </p>
                <p className="text-xs text-text-muted mb-3">
                  v{updateInfo.current} → {updateInfo.latest}
                </p>
                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-3 py-1.5 text-xs font-semibold rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  {t('settings.about.goToDownload')}
                </a>
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary border border-border/30 rounded hover:bg-surface-raised transition-all"
        >
          <Languages size={14} />
          {i18n.language === 'en' ? '中文' : 'EN'}
        </button>
      </div>
    </header>
  )
}

function HeaderButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  color: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-transparent transition-all duration-200',
        color
      )}
      title={label}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/AppHeader.tsx
git commit -m "feat(frontend): add update notification badge to AppHeader"
```

---

### Task 6: Settings Page "About" Section

**Files:**
- Modify: `web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add About section to SettingsPage**

Replace the entire `SettingsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/useApp'
import { api, type UserSettings, type UpdateInfo } from '@/api/client'
import i18n from '@/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const systemInfo = useApp((s) => s.systemInfo)
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [quadletDir, setQuadletDir] = useState('')
  const [podmanSocket, setPodmanSocket] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s)
      setQuadletDir(s.quadlet_dir || '')
      setPodmanSocket(s.podman_socket || '')
    }).catch(() => {})
  }, [])

  const { data: updateInfo } = useQuery<UpdateInfo>({
    queryKey: ['update-info'],
    queryFn: api.getUpdateInfo,
    retry: false,
  })

  const checkMutation = useMutation({
    mutationFn: () => api.checkUpdate(),
    onSuccess: (data) => {
      queryClient.setQueryData(['update-info'], data)
    },
  })

  const save = async (fields: Record<string, unknown>) => {
    setSaving(true)
    setMsg('')
    try {
      await api.updateSettings(fields)
      setMsg(t('common.success'))
    } catch {
      setMsg(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
        {t('settings.title')}
      </h2>

      <div className="border border-border rounded-lg bg-surface divide-y divide-border">
        <SettingsRow label={t('settings.language')}>
          <select
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value)
              save({ language: e.target.value })
            }}
            className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </SettingsRow>

        <SettingsRow label={t('settings.rootless')}>
          <span className="text-sm text-text-secondary">
            {systemInfo ? (systemInfo.rootless ? t('common.yes') : t('common.no')) : '-'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.quadletDir')}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={quadletDir}
              onChange={(e) => setQuadletDir(e.target.value)}
              placeholder={systemInfo?.quadletDir || '~/.config/containers/systemd/'}
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono w-96 focus:outline-none focus:border-accent"
            />
            <button
              disabled={saving || quadletDir === (settings?.quadlet_dir || '')}
              onClick={() => save({ quadlet_dir: quadletDir })}
              className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.save')}
            </button>
          </div>
        </SettingsRow>

        <SettingsRow label={t('settings.podmanSocket')}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={podmanSocket}
              onChange={(e) => setPodmanSocket(e.target.value)}
              placeholder={systemInfo ? (systemInfo.rootless ? '/run/user/1000/podman/podman.sock' : '/run/podman/podman.sock') : ''}
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono w-96 focus:outline-none focus:border-accent"
            />
            <button
              disabled={saving || podmanSocket === (settings?.podman_socket || '')}
              onClick={() => save({ podman_socket: podmanSocket })}
              className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.save')}
            </button>
          </div>
        </SettingsRow>
      </div>

      {msg && (
        <p className={`text-sm ${msg === t('common.success') ? 'text-green-400' : 'text-red-400'}`}>
          {msg}
        </p>
      )}

      {/* About Section */}
      <h3 className="text-sm font-bold tracking-wider text-text-primary uppercase">
        {t('settings.about.title')}
      </h3>

      <div className="border border-border rounded-lg bg-surface divide-y divide-border">
        <SettingsRow label={t('settings.about.currentVersion')}>
          <span className="text-sm text-text-secondary font-mono">
            {updateInfo?.current || systemInfo?.version || 'dev'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.about.latestVersion')}>
          {updateInfo?.hasUpdate ? (
            <span className="text-sm text-blue-400 font-mono">
              {updateInfo.latest}
              <span className="ml-2 text-xs text-blue-400/70">({t('settings.about.hasUpdate')})</span>
            </span>
          ) : (
            <span className="text-sm text-text-secondary font-mono">
              {updateInfo?.latest || '-'}
              {updateInfo && <span className="ml-2 text-xs text-green-400/70">({t('settings.about.noUpdate')})</span>}
            </span>
          )}
        </SettingsRow>

        {updateInfo?.checkedAt && (
          <SettingsRow label={t('settings.about.lastChecked')}>
            <span className="text-sm text-text-secondary">
              {new Date(updateInfo.checkedAt).toLocaleString()}
            </span>
          </SettingsRow>
        )}

        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checkMutation.isPending ? '...' : t('settings.about.checkUpdate')}
          </button>
          {updateInfo?.hasUpdate && updateInfo.releaseUrl && (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            >
              {t('settings.about.goToDownload')}
            </a>
          )}
        </div>

        {updateInfo?.releaseNote && (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
              {t('settings.about.releaseNotes')}
            </p>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-48 overflow-auto">
              {updateInfo.releaseNote}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-text-secondary">{label}</span>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/SettingsPage.tsx
git commit -m "feat(frontend): add About section to Settings page with update info"
```

---

### Task 7: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create release workflow**

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - goos: linux
            goarch: amd64
          - goos: linux
            goarch: arm64
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Build frontend
        run: cd web && npm ci && npm run build

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Build binary
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          mkdir -p cmd/quadlet-manager/web
          cp -r web/dist cmd/quadlet-manager/web/
          go build -ldflags "-s -w -X github.com/choken/quadlet-manager/internal/version.Version=$VERSION" \
            -o quadlet-manager-${{ matrix.goos }}-${{ matrix.goarch }} ./cmd/quadlet-manager

      - uses: actions/upload-artifact@v4
        with:
          name: quadlet-manager-${{ matrix.goos }}-${{ matrix.goarch }}
          path: quadlet-manager-*

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Generate checksums
        run: |
          cd artifacts
          sha256sum */* > ../checksums.txt

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/*/*
            checksums.txt
          generate_release_notes: true
```

- [ ] **Step 2: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Run tests
        run: go test ./internal/...

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install & build
        run: cd web && npm ci && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add GitHub Actions for release and CI"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all Go tests**

Run: `go test ./internal/...`
Expected: all tests PASS

- [ ] **Step 2: Verify frontend TypeScript**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify build**

Run: `make build`
Expected: `bin/quadlet-manager` binary created

- [ ] **Step 4: Check version injection**

Run: `./bin/quadlet-manager --help` or check logs for version output
Expected: version shows git describe output (e.g. `v0.1.0-8-g8db9606`)

- [ ] **Step 5: Final commit if needed**

```bash
git status
# If any uncommitted changes remain:
git add -A && git commit -m "chore: final cleanup for OTA update feature"
```
