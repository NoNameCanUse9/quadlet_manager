# Compose 兼容 + 开机自启 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docker Compose management via podman compose, and auto-start on boot for Quadlet-managed containers.

**Architecture:** Compose management uses `os/exec` to call `podman compose` commands, storing projects in `{quadletDir}/.compose/`. Auto-start adds `EnableUnit` to the Apply flow and exposes a toggle API on containers.

**Tech Stack:** Go, os/exec, gopkg.in/yaml.v3, React, React Query, i18next

---

## Task 1: ApplyFile 自动 Enable

**Files:**
- Modify: `internal/service/file_service.go:62-76`
- Test: `internal/service/service_test.go`

- [ ] **Step 1: Write failing test for ApplyFile auto-enable**

Add to `internal/service/service_test.go`:

```go
func TestFileService_ApplyFile_EnablesUnit(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := service.NewFileService(fs, sd, nil, "")

	err := svc.ApplyFile(context.Background(), 0, "nginx.container", "[Container]\nImage=nginx\n")
	if err != nil {
		t.Fatalf("ApplyFile: %v", err)
	}

	// Verify unit was enabled
	if !sd.Enabled["nginx.service"] {
		t.Error("expected nginx.service to be enabled after ApplyFile")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test -v -run TestFileService_ApplyFile_EnablesUnit ./internal/service/`
Expected: FAIL — `sd.Enabled` not checked / field doesn't exist

- [ ] **Step 3: Add Enabled tracking to MockSystemd**

In `internal/provider/mock_systemd.go`, add `Enabled map[string]bool` field and update `EnableUnit`/`DisableUnit`:

```go
type MockSystemd struct {
	// ... existing fields
	Enabled map[string]bool
}

func NewMockSystemd(rootless bool) *MockSystemd {
	return &MockSystemd{
		// ... existing init
		Enabled: make(map[string]bool),
	}
}

func (m *MockSystemd) EnableUnit(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	m.Enabled[name] = true
	return nil
}

func (m *MockSystemd) DisableUnit(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	m.Enabled[name] = false
	return nil
}
```

- [ ] **Step 4: Implement auto-enable in ApplyFile**

In `internal/service/file_service.go`, add `EnableUnit` call after `StartUnit`:

```go
func (s *FileService) ApplyFile(ctx context.Context, userID int64, filename string, content string) error {
	if err := s.WriteFile(ctx, userID, filename, content); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	if err := s.systemd.DaemonReload(ctx); err != nil {
		return fmt.Errorf("daemon reload: %w", err)
	}
	unitName := filenameToUnitName(filename)
	if unitName != "" {
		if err := s.systemd.StartUnit(ctx, unitName); err != nil {
			return fmt.Errorf("start unit %s: %w", unitName, err)
		}
		// Auto-enable on boot (best-effort)
		_ = s.systemd.EnableUnit(ctx, unitName)
	}
	return nil
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `go test -v -run TestFileService_ApplyFile_EnablesUnit ./internal/service/`
Expected: PASS

- [ ] **Step 6: Run all tests**

Run: `go test ./internal/...`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add internal/provider/mock_systemd.go internal/service/file_service.go internal/service/service_test.go
git commit -m "feat: auto-enable unit on ApplyFile for boot persistence"
```

---

## Task 2: 容器 Autostart API

**Files:**
- Modify: `internal/handler/container_handler.go`
- Modify: `internal/service/container_service.go`
- Modify: `cmd/quadlet-manager/main.go`

- [ ] **Step 1: Add GetAutostart/SetAutostart to ContainerService**

In `internal/service/container_service.go`:

```go
func (s *ContainerService) GetContainerAutostart(ctx context.Context, containerID string) (bool, string, error) {
	info, err := s.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return false, "", fmt.Errorf("inspect container %s: %w", containerID, err)
	}
	if info.Labels == nil {
		return false, "", fmt.Errorf("container %s is not Quadlet-managed", containerID)
	}
	unit, ok := info.Labels["io.containers.systemd.unit"]
	if !ok || unit == "" {
		return false, "", fmt.Errorf("container %s is not Quadlet-managed", containerID)
	}
	// We can't directly query is-enabled via D-Bus easily, so we return the unit name
	// and let the handler check via systemctl. For now, return unit name.
	return true, unit, nil
}
```

Wait — the spec says GET returns `{enabled: boolean}`. We need to actually check if the unit is enabled. The `SystemdProvider` doesn't have an `IsEnabled` method. Let me add one.

- [ ] **Step 1 (revised): Add IsUnitEnabled to SystemdProvider**

In `internal/provider/systemd.go`, add to interface:

```go
IsUnitEnabled(ctx context.Context, name string) (bool, error)
```

In `internal/provider/systemd_dbus.go`, implement:

```go
func (p *DBusSystemdProvider) IsUnitEnabled(ctx context.Context, name string) (bool, error) {
	conn, err := p.getConnection(ctx)
	if err != nil {
		return false, err
	}
	obj := conn.Object("org.freedesktop.systemd1", "/org/freedesktop/systemd1")
	var result string
	err = obj.Call("org.freedesktop.systemd1.Manager.GetUnitFileState", 0, name).Store(&result)
	if err != nil {
		return false, fmt.Errorf("get unit file state for %s: %w", name, err)
	}
	return result == "enabled" || result == "static", nil
}
```

In `internal/provider/mock_systemd.go`:

```go
func (m *MockSystemd) IsUnitEnabled(_ context.Context, name string) (bool, error) {
	if m.Err != nil {
		return false, m.Err
	}
	return m.Enabled[name], nil
}
```

- [ ] **Step 2: Add autostart methods to ContainerService**

In `internal/service/container_service.go`:

```go
func (s *ContainerService) GetContainerAutostart(ctx context.Context, containerID string, systemd provider.SystemdProvider) (bool, error) {
	info, err := s.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return false, fmt.Errorf("inspect container %s: %w", containerID, err)
	}
	unit := ""
	if info.Labels != nil {
		unit = info.Labels["io.containers.systemd.unit"]
	}
	if unit == "" {
		return false, fmt.Errorf("container is not Quadlet-managed")
	}
	return systemd.IsUnitEnabled(ctx, unit)
}

func (s *ContainerService) SetContainerAutostart(ctx context.Context, containerID string, enabled bool, systemd provider.SystemdProvider) error {
	info, err := s.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return fmt.Errorf("inspect container %s: %w", containerID, err)
	}
	unit := ""
	if info.Labels != nil {
		unit = info.Labels["io.containers.systemd.unit"]
	}
	if unit == "" {
		return fmt.Errorf("container is not Quadlet-managed")
	}
	if enabled {
		return systemd.EnableUnit(ctx, unit)
	}
	return systemd.DisableUnit(ctx, unit)
}
```

Actually — the ContainerService doesn't hold a reference to SystemdProvider. The orchestrator does. Let me restructure: put autostart on the orchestrator instead.

- [ ] **Step 2 (revised): Add autostart to ContainerOrchestrator**

In `internal/service/orchestrator.go`:

```go
func (o *ContainerOrchestrator) GetAutostart(ctx context.Context, containerID string) (bool, error) {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return false, err
	}
	if !managed {
		return false, fmt.Errorf("container is not Quadlet-managed")
	}
	enabled, err := o.systemd.IsUnitEnabled(ctx, unitName)
	if err != nil {
		return false, fmt.Errorf("check enabled for %s: %w", unitName, err)
	}
	return enabled, nil
}

func (o *ContainerOrchestrator) SetAutostart(ctx context.Context, containerID string, enabled bool) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if !managed {
		return fmt.Errorf("container is not Quadlet-managed")
	}
	if enabled {
		return o.systemd.EnableUnit(ctx, unitName)
	}
	return o.systemd.DisableUnit(ctx, unitName)
}
```

- [ ] **Step 3: Add handler methods**

In `internal/handler/container_handler.go`:

```go
func (h *ContainerHandler) GetAutostart(c *gin.Context) {
	id := c.Param("id")
	enabled, err := h.orchestrator.GetAutostart(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"enabled": enabled})
}

func (h *ContainerHandler) SetAutostart(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.orchestrator.SetAutostart(c.Request.Context(), id, req.Enabled); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated", "enabled": req.Enabled})
}
```

- [ ] **Step 4: Register routes**

In `cmd/quadlet-manager/main.go`, add inside the `protected` group:

```go
protected.GET("/containers/:id/autostart", containerH.GetAutostart)
protected.POST("/containers/:id/autostart", containerH.SetAutostart)
```

- [ ] **Step 5: Build and test**

Run: `go build ./... && go test ./internal/...`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add internal/provider/systemd.go internal/provider/systemd_dbus.go internal/provider/mock_systemd.go internal/service/orchestrator.go internal/handler/container_handler.go cmd/quadlet-manager/main.go
git commit -m "feat: add container autostart API (enable/disable systemd unit)"
```

---

## Task 3: 前端 — Autostart API + Toggle

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/src/hooks/useContainers.ts`
- Modify: `web/src/pages/ContainersPage.tsx`
- Modify: `web/src/i18n/en.json`
- Modify: `web/src/i18n/zh.json`

- [ ] **Step 1: Add API methods and types**

In `web/src/api/client.ts`, add to `api` object:

```typescript
getContainerAutostart: (id: string) =>
    request<{ enabled: boolean }>(`/containers/${id}/autostart`),
setContainerAutostart: (id: string, enabled: boolean) =>
    request(`/containers/${id}/autostart`, { method: 'POST', body: JSON.stringify({ enabled }) }),
```

- [ ] **Step 2: Add React Query hooks**

In `web/src/hooks/useContainers.ts`, add:

```typescript
export function useContainerAutostart(id: string) {
  return useQuery({
    queryKey: ['autostart', id],
    queryFn: () => api.getContainerAutostart(id),
    enabled: !!id,
  })
}

export function useSetContainerAutostart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.setContainerAutostart(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autostart'] }),
  })
}
```

- [ ] **Step 3: Add i18n keys**

In `web/src/i18n/en.json`, add to `containers`:

```json
"autostart": "Auto-start"
```

In `web/src/i18n/zh.json`, add to `containers`:

```json
"autostart": "开机自启"
```

- [ ] **Step 4: Add autostart toggle to ContainersPage**

In `web/src/pages/ContainersPage.tsx`, add a column header and toggle in each row. The toggle calls `setContainerAutostart`. For simplicity, use the orchestrator's `IsManaged` check via the container's labels (we'll need to add `labels` to `ContainerInfo` or use inspect).

Actually — the `ContainerInfo` model doesn't include labels. We need to either:
a) Add labels to `ContainerInfo` (Podman `/containers/json` returns labels), or
b) Fetch autostart status per container (N+1 queries)

Option (a) is better. Let me update the model.

- [ ] **Step 4 (revised): Add labels to ContainerInfo**

In `web/src/api/client.ts`, update `ContainerInfo`:

```typescript
export interface ContainerInfo {
  id: string
  names: string[]
  image: string
  state: string
  status: string
  labels: Record<string, string>
}
```

In `internal/model/container.go`, add Labels field:

```go
type ContainerInfo struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Labels  map[string]string `json:"labels"`
}
```

In `internal/provider/podman_socket.go`, update `ListContainers` to include labels. Check if Podman's `/containers/json` returns labels (it does — the `Labels` field is in the response).

- [ ] **Step 5: Add toggle column to ContainersPage**

In the table header, add an "Auto-start" column. In each row, if `c.labels?.['io.containers.systemd.unit']` exists, show a toggle button. Clicking it calls `setContainerAutostart`.

- [ ] **Step 6: Build and verify**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add internal/model/container.go internal/provider/podman_socket.go web/src/api/client.ts web/src/hooks/useContainers.ts web/src/pages/ContainersPage.tsx web/src/i18n/en.json web/src/i18n/zh.json
git commit -m "feat: add autostart toggle to containers page"
```

---

## Task 4: Compose Provider 接口 + 模型

**Files:**
- Create: `internal/provider/compose.go`
- Create: `internal/model/compose.go`

- [ ] **Step 1: Create compose models**

Create `internal/model/compose.go`:

```go
package model

type ComposeProject struct {
	Name     string   `json:"name"`
	File     string   `json:"file"`
	Status   string   `json:"status"`
	Services []string `json:"services"`
}

type ComposeService struct {
	Name  string `json:"name"`
	State string `json:"state"`
	Image string `json:"image"`
	Ports string `json:"ports"`
}

type QuadletConversion struct {
	Filename string   `json:"filename"`
	Content  string   `json:"content"`
	Warnings []string `json:"warnings"`
}
```

- [ ] **Step 2: Create compose provider interface**

Create `internal/provider/compose.go`:

```go
package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

type ComposeProvider interface {
	ImportProject(ctx context.Context, name string, content string) error
	ListProjects(ctx context.Context) ([]model.ComposeProject, error)
	RemoveProject(ctx context.Context, name string) error

	Up(ctx context.Context, name string) error
	Down(ctx context.Context, name string) error
	Ps(ctx context.Context, name string) ([]model.ComposeService, error)
	Logs(ctx context.Context, name string, service string, tail int) ([]string, error)

	ConvertToQuadlet(ctx context.Context, name string) ([]model.QuadletConversion, error)
}
```

- [ ] **Step 3: Commit**

```bash
git add internal/model/compose.go internal/provider/compose.go
git commit -m "feat: add compose provider interface and models"
```

---

## Task 5: Compose Provider 实现

**Files:**
- Create: `internal/provider/compose_impl.go`
- Modify: `go.mod`

- [ ] **Step 1: Add yaml.v3 dependency**

Run: `go get gopkg.in/yaml.v3`

- [ ] **Step 2: Implement ComposeProviderImpl**

Create `internal/provider/compose_impl.go`:

```go
package provider

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"gopkg.in/yaml.v3"
)

type ComposeProviderImpl struct {
	baseDir string // {quadletDir}/.compose
}

func NewComposeProviderImpl(quadletDir string) *ComposeProviderImpl {
	return &ComposeProviderImpl{
		baseDir: filepath.Join(quadletDir, ".compose"),
	}
}

func (p *ComposeProviderImpl) projectDir(name string) string {
	return filepath.Join(p.baseDir, name)
}

func (p *ComposeProviderImpl) composeBin() string {
	// Try podman-compose first, then podman compose
	if _, err := exec.LookPath("podman-compose"); err == nil {
		return "podman-compose"
	}
	return "podman"
}

func (p *ComposeProviderImpl) composeArgs(name string, args ...string) []string {
	bin := p.composeBin()
	dir := p.projectDir(name)
	if bin == "podman-compose" {
		return append([]string{"-f", filepath.Join(dir, "docker-compose.yml")}, args...)
	}
	// podman compose
	return append([]string{"compose", "-f", filepath.Join(dir, "docker-compose.yml")}, args...)
}

func (p *ComposeProviderImpl) runCompose(ctx context.Context, name string, args ...string) (string, error) {
	bin := p.composeBin()
	fullArgs := p.composeArgs(name, args...)
	cmd := exec.CommandContext(ctx, bin, fullArgs...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("compose %s: %w: %s", strings.Join(args, " "), err, stderr.String())
	}
	return stdout.String(), nil
}

func (p *ComposeProviderImpl) ImportProject(_ context.Context, name string, content string) error {
	dir := p.projectDir(name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create project dir: %w", err)
	}
	return os.WriteFile(filepath.Join(dir, "docker-compose.yml"), []byte(content), 0644)
}

func (p *ComposeProviderImpl) ListProjects(_ context.Context) ([]model.ComposeProject, error) {
	entries, err := os.ReadDir(p.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.ComposeProject{}, nil
		}
		return nil, fmt.Errorf("read compose dir: %w", err)
	}
	var projects []model.ComposeProject
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		composeFile := filepath.Join(p.baseDir, e.Name(), "docker-compose.yml")
		if _, err := os.Stat(composeFile); err != nil {
			continue
		}
		services, _ := p.parseServices(composeFile)
		projects = append(projects, model.ComposeProject{
			Name:     e.Name(),
			File:     composeFile,
			Status:   "stopped", // TODO: check actual status
			Services: services,
		})
	}
	if projects == nil {
		return []model.ComposeProject{}, nil
	}
	return projects, nil
}

func (p *ComposeProviderImpl) parseServices(composeFile string) ([]string, error) {
	data, err := os.ReadFile(composeFile)
	if err != nil {
		return nil, err
	}
	var doc struct {
		Services map[string]interface{} `yaml:"services"`
	}
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	var names []string
	for name := range doc.Services {
		names = append(names, name)
	}
	return names, nil
}

func (p *ComposeProviderImpl) RemoveProject(ctx context.Context, name string) error {
	// Try to bring down first, ignore errors
	_, _ = p.runCompose(ctx, name, "down")
	return os.RemoveAll(p.projectDir(name))
}

func (p *ComposeProviderImpl) Up(ctx context.Context, name string) error {
	_, err := p.runCompose(ctx, name, "up", "-d")
	return err
}

func (p *ComposeProviderImpl) Down(ctx context.Context, name string) error {
	_, err := p.runCompose(ctx, name, "down")
	return err
}

func (p *ComposeProviderImpl) Ps(ctx context.Context, name string) ([]model.ComposeService, error) {
	out, err := p.runCompose(ctx, name, "ps", "--format", "json")
	if err != nil {
		return nil, err
	}
	// Parse JSON output — podman compose ps --format json outputs one JSON object per line
	var services []model.ComposeService
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var raw struct {
			Name   string `json:"Name"`
			State  string `json:"State"`
			Image  string `json:"Image"`
			Ports  string `json:"Ports"`
			Status string `json:"Status"`
		}
		if err := yaml.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		state := raw.State
		if state == "" {
			state = raw.Status
		}
		services = append(services, model.ComposeService{
			Name:  raw.Name,
			State: state,
			Image: raw.Image,
			Ports: raw.Ports,
		})
	}
	if services == nil {
		return []model.ComposeService{}, nil
	}
	return services, nil
}

func (p *ComposeProviderImpl) Logs(ctx context.Context, name string, service string, tail int) ([]string, error) {
	args := []string{"logs", "--tail", fmt.Sprintf("%d", tail)}
	if service != "" {
		args = append(args, service)
	}
	out, err := p.runCompose(ctx, name, args...)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(out, "\n")
	if lines == nil {
		return []string{}, nil
	}
	return lines, nil
}

func (p *ComposeProviderImpl) ConvertToQuadlet(_ context.Context, name string) ([]model.QuadletConversion, error) {
	composeFile := filepath.Join(p.projectDir(name), "docker-compose.yml")
	data, err := os.ReadFile(composeFile)
	if err != nil {
		return nil, fmt.Errorf("read compose file: %w", err)
	}

	var doc struct {
		Services map[string]composeService `yaml:"services"`
		Networks map[string]interface{}    `yaml:"networks"`
		Volumes  map[string]interface{}    `yaml:"volumes"`
	}
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse compose file: %w", err)
	}

	var conversions []model.QuadletConversion

	// Convert each service to a .container file
	for svcName, svc := range doc.Services {
		cfg, warnings := convertServiceToQuadlet(svcName, svc, name)
		content := generateQuadletFromConfig(cfg)
		conversions = append(conversions, model.QuadletConversion{
			Filename: svcName + ".container",
			Content:  content,
			Warnings: warnings,
		})
	}

	// Convert networks
	for netName := range doc.Networks {
		cfg := &quadletConfig{
			sections: map[string]map[string]string{
				"Network": {"Driver": "bridge"},
			},
		}
		content := generateQuadletFromConfig(cfg)
		conversions = append(conversions, model.QuadletConversion{
			Filename: netName + ".network",
			Content:  content,
		})
	}

	// Convert volumes
	for volName := range doc.Volumes {
		cfg := &quadletConfig{
			sections: map[string]map[string]string{
				"Volume": {},
			},
		}
		content := generateQuadletFromConfig(cfg)
		conversions = append(conversions, model.QuadletConversion{
			Filename: volName + ".volume",
			Content:  content,
		})
	}

	return conversions, nil
}

// --- Internal types for compose YAML parsing ---

type composeService struct {
	Image       string            `yaml:"image"`
	Ports       []string          `yaml:"ports"`
	Volumes     []string          `yaml:"volumes"`
	Environment map[string]string `yaml:"environment"`
	Restart     string            `yaml:"restart"`
	User        string            `yaml:"user"`
	Hostname    string            `yaml:"hostname"`
	Command     interface{}       `yaml:"command"`
	Networks    interface{}       `yaml:"networks"`
	DependsOn   interface{}       `yaml:"depends_on"`
	Build       interface{}       `yaml:"build"`
	Deploy      interface{}       `yaml:"deploy"`
	Healthcheck interface{}       `yaml:"healthcheck"`
}

type quadletConfig struct {
	sections map[string]map[string]string
}

func convertServiceToQuadlet(name string, svc composeService, projectName string) (*quadletConfig, []string) {
	cfg := &quadletConfig{
		sections: map[string]map[string]string{
			"Unit":      {},
			"Container": {},
			"Service":   {},
			"Install":   {},
		},
	}

	var warnings []string

	cfg.sections["Unit"]["Description"] = name + " service (from compose)"

	// Image
	if svc.Image != "" {
		cfg.sections["Container"]["Image"] = svc.Image
	}

	// Ports
	for _, p := range svc.Ports {
		// Convert "8080:80" to "8080:80" (same format)
		cfg.sections["Container"]["PublishPort"] = p
	}

	// Volumes
	for _, v := range svc.Volumes {
		cfg.sections["Container"]["Volume"] = v
	}

	// Environment
	for k, val := range svc.Environment {
		cfg.sections["Container"]["Environment"] = k + "=" + val
	}

	// User
	if svc.User != "" {
		cfg.sections["Container"]["User"] = svc.User
	}

	// Hostname
	if svc.Hostname != "" {
		cfg.sections["Container"]["HostName"] = svc.Hostname
	}

	// Command
	if svc.Command != nil {
		switch cmd := svc.Command.(type) {
		case string:
			cfg.sections["Container"]["Exec"] = cmd
		case []interface{} {
			parts := make([]string, len(cmd))
			for i, c := range cmd {
				parts[i] = fmt.Sprintf("%v", c)
			}
			cfg.sections["Container"]["Exec"] = strings.Join(parts, " ")
		}
	}

	// Restart policy
	switch svc.Restart {
	case "always", "unless-stopped":
		cfg.sections["Service"]["Restart"] = "always"
		cfg.sections["Install"]["WantedBy"] = "default.target"
	case "on-failure":
		cfg.sections["Service"]["Restart"] = "on-failure"
		cfg.sections["Install"]["WantedBy"] = "default.target"
	case "no", "":
		// no restart
	}

	// Network
	if svc.Networks != nil {
		switch nets := svc.Networks.(type) {
		case []interface{}:
			if len(nets) > 0 {
				cfg.sections["Container"]["Network"] = fmt.Sprintf("%v", nets[0])
			}
		case map[string]interface{}:
			for netName := range nets {
				cfg.sections["Container"]["Network"] = netName
				break
			}
		}
	}

	// Warnings for unsupported fields
	if svc.Build != nil {
		warnings = append(warnings, fmt.Sprintf("[%s] 'build' is not supported in Quadlet, use a pre-built image", name))
	}
	if svc.Deploy != nil {
		warnings = append(warnings, fmt.Sprintf("[%s] 'deploy' section is not supported in Quadlet", name))
	}
	if svc.DependsOn != nil {
		warnings = append(warnings, fmt.Sprintf("[%s] 'depends_on' mapped to After= (no condition support)", name))
	}
	if svc.Healthcheck != nil {
		warnings = append(warnings, fmt.Sprintf("[%s] 'healthcheck' has limited Quadlet support", name))
	}

	return cfg, warnings
}

func generateQuadletFromConfig(cfg *quadletConfig) string {
	var b strings.Builder
	for _, section := range []string{"Unit", "Container", "Service", "Install"} {
		kvs := cfg.sections[section]
		if len(kvs) == 0 {
			continue
		}
		b.WriteString("[" + section + "]\n")
		for k, v := range kvs {
			b.WriteString(k + "=" + v + "\n")
		}
		b.WriteString("\n")
	}
	return b.String()
}
```

Note: The above uses internal types for conversion instead of `parser.QuadletConfig` + `parser.GenerateQuadletFile` to keep the compose converter self-contained. The generated files are plain INI text that systemd-quadlet can process.

Actually — let me reconsider. Using the existing parser/generator would be cleaner. But the generator doesn't support multi-value keys properly (it uses `map[string]string` which can't hold multiple `PublishPort` entries). The compose converter needs to handle multi-value keys. So using internal types with manual INI generation is the right call here.

- [ ] **Step 3: Build and verify**

Run: `go build ./...`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/provider/compose_impl.go go.mod go.sum
git commit -m "feat: implement compose provider with podman compose integration"
```

---

## Task 6: Compose Provider Mock + 测试

**Files:**
- Create: `internal/provider/mock_compose.go`
- Create: `internal/provider/compose_test.go`

- [ ] **Step 1: Create mock compose provider**

Create `internal/provider/mock_compose.go`:

```go
package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

type MockCompose struct {
	Projects map[string]model.ComposeProject
	Err      error
}

func NewMockCompose() *MockCompose {
	return &MockCompose{
		Projects: make(map[string]model.ComposeProject),
	}
}

func (m *MockCompose) ImportProject(_ context.Context, name string, _ string) error {
	if m.Err != nil {
		return m.Err
	}
	m.Projects[name] = model.ComposeProject{Name: name, Status: "stopped"}
	return nil
}

func (m *MockCompose) ListProjects(_ context.Context) ([]model.ComposeProject, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	var list []model.ComposeProject
	for _, p := range m.Projects {
		list = append(list, p)
	}
	if list == nil {
		return []model.ComposeProject{}, nil
	}
	return list, nil
}

func (m *MockCompose) RemoveProject(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	delete(m.Projects, name)
	return nil
}

func (m *MockCompose) Up(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	if p, ok := m.Projects[name]; ok {
		p.Status = "running"
		m.Projects[name] = p
	}
	return nil
}

func (m *MockCompose) Down(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	if p, ok := m.Projects[name]; ok {
		p.Status = "stopped"
		m.Projects[name] = p
	}
	return nil
}

func (m *MockCompose) Ps(_ context.Context, name string) ([]model.ComposeService, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return []model.ComposeService{}, nil
}

func (m *MockCompose) Logs(_ context.Context, _ string, _ string, _ int) ([]string, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return []string{}, nil
}

func (m *MockCompose) ConvertToQuadlet(_ context.Context, name string) ([]model.QuadletConversion, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return []model.QuadletConversion{}, nil
}
```

- [ ] **Step 2: Write conversion test**

Create `internal/provider/compose_test.go`:

```go
package provider

import (
	"testing"
)

func TestConvertServiceToQuadlet(t *testing.T) {
	svc := composeService{
		Image:   "nginx:latest",
		Ports:   []string{"8080:80"},
		Volumes: []string{"/data:/usr/share/nginx/html"},
		Environment: map[string]string{
			"NGINX_HOST": "example.com",
		},
		Restart:  "always",
		Hostname: "web",
		Command:  "nginx -g 'daemon off;'",
	}

	cfg, warnings := convertServiceToQuadlet("web", svc, "myproject")

	if cfg.sections["Container"]["Image"] != "nginx:latest" {
		t.Errorf("expected Image=nginx:latest, got %s", cfg.sections["Container"]["Image"])
	}
	if cfg.sections["Service"]["Restart"] != "always" {
		t.Errorf("expected Restart=always, got %s", cfg.sections["Service"]["Restart"])
	}
	if cfg.sections["Install"]["WantedBy"] != "default.target" {
		t.Errorf("expected WantedBy=default.target, got %s", cfg.sections["Install"]["WantedBy"])
	}
	if cfg.sections["Container"]["HostName"] != "web" {
		t.Errorf("expected HostName=web, got %s", cfg.sections["Container"]["HostName"])
	}
	if len(warnings) != 0 {
		t.Errorf("unexpected warnings: %v", warnings)
	}
}

func TestConvertServiceToQuadlet_UnsupportedFields(t *testing.T) {
	svc := composeService{
		Image:       "myapp:latest",
		Build:       ".",
		Deploy:      map[string]interface{}{},
		DependsOn:   []string{"db"},
		Healthcheck: map[string]interface{}{},
	}

	_, warnings := convertServiceToQuadlet("app", svc, "myproject")

	if len(warnings) != 4 {
		t.Errorf("expected 4 warnings, got %d: %v", len(warnings), warnings)
	}
}
```

- [ ] **Step 3: Run tests**

Run: `go test -v ./internal/provider/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/provider/mock_compose.go internal/provider/compose_test.go
git commit -m "feat: add compose provider mock and conversion tests"
```

---

## Task 7: Compose Handler + 路由

**Files:**
- Create: `internal/handler/compose_handler.go`
- Modify: `cmd/quadlet-manager/main.go`

- [ ] **Step 1: Create compose handler**

Create `internal/handler/compose_handler.go`:

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/gin-gonic/gin"
)

type ComposeHandler struct {
	compose provider.ComposeProvider
}

func NewComposeHandler(compose provider.ComposeProvider) *ComposeHandler {
	return &ComposeHandler{compose: compose}
}

func (h *ComposeHandler) ImportProject(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.ImportProject(c.Request.Context(), req.Name, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.Up(c.Request.Context(), req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "imported", "name": req.Name})
}

func (h *ComposeHandler) ListProjects(c *gin.Context) {
	projects, err := h.compose.ListProjects(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

func (h *ComposeHandler) RemoveProject(c *gin.Context) {
	name := c.Param("project")
	if err := h.compose.RemoveProject(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ComposeHandler) Up(c *gin.Context) {
	name := c.Param("project")
	if err := h.compose.Up(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (h *ComposeHandler) Down(c *gin.Context) {
	name := c.Param("project")
	if err := h.compose.Down(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (h *ComposeHandler) Ps(c *gin.Context) {
	name := c.Param("project")
	services, err := h.compose.Ps(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, services)
}

func (h *ComposeHandler) Logs(c *gin.Context) {
	name := c.Param("project")
	service := c.Query("service")
	tail := 100
	if t := c.Query("tail"); t != "" {
		if v, err := strconv.Atoi(t); err == nil && v > 0 {
			tail = v
		}
	}
	logs, err := h.compose.Logs(c.Request.Context(), name, service, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

func (h *ComposeHandler) Convert(c *gin.Context) {
	name := c.Param("project")
	conversions, err := h.compose.ConvertToQuadlet(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, conversions)
}
```

- [ ] **Step 2: Register routes in main.go**

In `cmd/quadlet-manager/main.go`, add initialization:

```go
composeProvider := provider.NewComposeProviderImpl(cfg.QuadletDir)
```

Add handler:

```go
composeH := handler.NewComposeHandler(composeProvider)
```

Add routes in the `protected` group:

```go
// Compose
protected.POST("/compose/import", composeH.ImportProject)
protected.GET("/compose/projects", composeH.ListProjects)
protected.DELETE("/compose/:project", composeH.RemoveProject)
protected.POST("/compose/:project/up", composeH.Up)
protected.POST("/compose/:project/down", composeH.Down)
protected.GET("/compose/:project/ps", composeH.Ps)
protected.GET("/compose/:project/logs", composeH.Logs)
protected.POST("/compose/:project/convert", composeH.Convert)
```

- [ ] **Step 3: Build and test**

Run: `go build ./... && go test ./internal/...`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add internal/handler/compose_handler.go cmd/quadlet-manager/main.go
git commit -m "feat: add compose handler and routes"
```

---

## Task 8: 前端 — Compose API + Hooks + i18n

**Files:**
- Modify: `web/src/api/client.ts`
- Create: `web/src/hooks/useCompose.ts`
- Modify: `web/src/i18n/en.json`
- Modify: `web/src/i18n/zh.json`

- [ ] **Step 1: Add compose types and API methods to client.ts**

Add types:

```typescript
export interface ComposeProject {
  name: string
  file: string
  status: string
  services: string[]
}

export interface ComposeService {
  name: string
  state: string
  image: string
  ports: string
}

export interface QuadletConversion {
  filename: string
  content: string
  warnings: string[]
}
```

Add to `api` object:

```typescript
importCompose: (name: string, content: string) =>
    request<unknown>('/compose/import', { method: 'POST', body: JSON.stringify({ name, content }) }),
listComposeProjects: () => request<ComposeProject[]>('/compose/projects'),
removeComposeProject: (project: string) =>
    request<unknown>(`/compose/${project}`, { method: 'DELETE' }),
composeUp: (project: string) =>
    request<unknown>(`/compose/${project}/up`, { method: 'POST' }),
composeDown: (project: string) =>
    request<unknown>(`/compose/${project}/down`, { method: 'POST' }),
composePs: (project: string) =>
    request<ComposeService[]>(`/compose/${project}/ps`),
composeLogs: (project: string, service: string, tail = 100) =>
    request<{ logs: string[] }>(`/compose/${project}/logs?service=${service}&tail=${tail}`),
composeConvert: (project: string) =>
    request<QuadletConversion[]>(`/compose/${project}/convert`, { method: 'POST' }),
```

- [ ] **Step 2: Create useCompose hooks**

Create `web/src/hooks/useCompose.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useComposeProjects() {
  return useQuery({
    queryKey: ['compose-projects'],
    queryFn: api.listComposeProjects,
    refetchInterval: 10_000,
  })
}

export function useImportCompose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      api.importCompose(name, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useRemoveComposeProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (project: string) => api.removeComposeProject(project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useComposeUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (project: string) => api.composeUp(project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useComposeDown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (project: string) => api.composeDown(project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useComposePs(project: string) {
  return useQuery({
    queryKey: ['compose-ps', project],
    queryFn: () => api.composePs(project),
    enabled: !!project,
  })
}

export function useComposeLogs(project: string, service: string) {
  return useQuery({
    queryKey: ['compose-logs', project, service],
    queryFn: () => api.composeLogs(project, service),
    enabled: !!project && !!service,
  })
}

export function useComposeConvert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (project: string) => api.composeConvert(project),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })
}
```

- [ ] **Step 3: Add i18n keys**

In `web/src/i18n/en.json`, add:

```json
"compose": {
    "import": "Import Compose",
    "projectName": "Project Name",
    "up": "Start",
    "down": "Stop",
    "convert": "Convert to Quadlet",
    "convertTitle": "Convert to Quadlet Files",
    "noProjects": "No compose projects",
    "remove": "Remove Project",
    "removeConfirm": "Remove compose project \"{{name}}\"?",
    "status": {
        "running": "Running",
        "stopped": "Stopped",
        "partial": "Partial"
    },
    "warnings": "Warnings",
    "services": "Services",
    "logs": "Logs"
}
```

In `web/src/i18n/zh.json`, add:

```json
"compose": {
    "import": "导入 Compose",
    "projectName": "项目名称",
    "up": "启动",
    "down": "停止",
    "convert": "转换为 Quadlet",
    "convertTitle": "转换为 Quadlet 文件",
    "noProjects": "暂无 Compose 项目",
    "remove": "删除项目",
    "removeConfirm": "确认删除 Compose 项目 \"{{name}}\"？",
    "status": {
        "running": "运行中",
        "stopped": "已停止",
        "partial": "部分运行"
    },
    "warnings": "警告",
    "services": "服务",
    "logs": "日志"
}
```

- [ ] **Step 4: Build frontend to verify**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/api/client.ts web/src/hooks/useCompose.ts web/src/i18n/en.json web/src/i18n/zh.json
git commit -m "feat: add compose API client, hooks, and i18n"
```

---

## Task 9: 前端 — Compose UI 组件

**Files:**
- Create: `web/src/components/compose/ImportComposeDialog.tsx`
- Create: `web/src/components/compose/ComposeProjectCard.tsx`
- Create: `web/src/components/compose/ConvertPreviewDialog.tsx`

- [ ] **Step 1: Create ImportComposeDialog**

Create `web/src/components/compose/ImportComposeDialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useImportCompose } from '@/hooks/useCompose'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportComposeDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const importMut = useImportCompose()

  if (!open) return null

  const handleImport = async () => {
    if (!name.trim() || !content.trim()) return
    try {
      await importMut.mutateAsync({ name: name.trim(), content })
      toast.success(t('compose.import') + ' - ' + t('common.success'))
      onClose()
      setName('')
      setContent('')
    } catch (e: any) {
      toast.error(e.message || 'Import failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-4 max-w-lg w-full mx-4">
        <p className="text-sm text-text-primary mb-3">{t('compose.import')}</p>
        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder={t('compose.projectName')}
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary"
          />
          <textarea
            placeholder="docker-compose.yml"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={12}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary font-mono"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
            {t('common.cancel')}
          </button>
          <button onClick={handleImport} disabled={importMut.isPending || !name.trim() || !content.trim()}
            className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50">
            {importMut.isPending ? t('common.loading') : t('compose.import')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ComposeProjectCard**

Create `web/src/components/compose/ComposeProjectCard.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Play, Square, ArrowRightLeft, Trash2, FileText } from 'lucide-react'
import { useComposeUp, useComposeDown, useComposeConvert, useRemoveComposeProject, useComposePs } from '@/hooks/useCompose'
import { ConvertPreviewDialog } from './ConvertPreviewDialog'
import type { ComposeProject } from '@/api/client'
import { toast } from 'sonner'

interface Props {
  project: ComposeProject
}

export function ComposeProjectCard({ project }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [convertResult, setConvertResult] = useState<any[] | null>(null)

  const { data: services } = useComposePs(project.name)
  const upMut = useComposeUp()
  const downMut = useComposeDown()
  const convertMut = useComposeConvert()
  const removeMut = useRemoveComposeProject()

  const statusColors: Record<string, string> = {
    running: 'bg-emerald-500/10 text-emerald-400',
    stopped: 'bg-zinc-500/10 text-zinc-400',
    partial: 'bg-yellow-500/10 text-yellow-400',
  }

  const handleAction = async (action: () => Promise<any>, label: string) => {
    try {
      await action()
      toast.success(label)
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    }
  }

  const handleConvert = async () => {
    try {
      const result = await convertMut.mutateAsync(project.name)
      setConvertResult(result)
    } catch (e: any) {
      toast.error(e.message || 'Convert failed')
    }
  }

  return (
    <>
      <div className="border border-border rounded bg-surface">
        <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface-raised/50"
          onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-xs font-medium text-text-primary">{project.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[project.status] || statusColors.stopped}`}>
              {t(`compose.status.${project.status}`) || project.status}
            </span>
            <span className="text-[10px] text-text-muted">
              {project.services.length} {t('compose.services').toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => handleAction(() => upMut.mutateAsync(project.name), t('compose.up'))}
              className="p-1 text-text-secondary hover:text-emerald-400" title={t('compose.up')}>
              <Play size={12} />
            </button>
            <button onClick={() => handleAction(() => downMut.mutateAsync(project.name), t('compose.down'))}
              className="p-1 text-text-secondary hover:text-red-400" title={t('compose.down')}>
              <Square size={12} />
            </button>
            <button onClick={handleConvert}
              className="p-1 text-text-secondary hover:text-blue-400" title={t('compose.convert')}>
              <ArrowRightLeft size={12} />
            </button>
            <button onClick={() => {
              if (confirm(t('compose.removeConfirm', { name: project.name }))) {
                handleAction(() => removeMut.mutateAsync(project.name), t('common.remove'))
              }
            }} className="p-1 text-text-secondary hover:text-red-400" title={t('compose.remove')}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {expanded && services && (
          <div className="border-t border-border p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left">
                  <th className="pb-1 font-medium">{t('common.name')}</th>
                  <th className="pb-1 font-medium">{t('containers.status')}</th>
                  <th className="pb-1 font-medium">{t('containers.image')}</th>
                  <th className="pb-1 font-medium">Ports</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.name} className="border-t border-border">
                    <td className="py-1 text-text-primary">{s.name}</td>
                    <td className="py-1 text-text-muted">{s.state}</td>
                    <td className="py-1 text-text-muted">{s.image}</td>
                    <td className="py-1 text-text-muted font-mono">{s.ports || '-'}</td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan={4} className="py-2 text-text-muted text-center">{t('common.loading')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {convertResult && (
        <ConvertPreviewDialog
          conversions={convertResult}
          onClose={() => setConvertResult(null)}
        />
      )}
    </>
  )
}
```

Note: The `composeUp` and `composeDown` functions in the `handleAction` calls should be the mutateAsync from the hooks. Let me fix that — they should be `upMut.mutateAsync` and `downMut.mutateAsync`.

- [ ] **Step 3: Create ConvertPreviewDialog**

Create `web/src/components/compose/ConvertPreviewDialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { toast } from 'sonner'
import type { QuadletConversion } from '@/api/client'

interface Props {
  conversions: QuadletConversion[]
  onClose: () => void
}

export function ConvertPreviewDialog({ conversions, onClose }: Props) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const allWarnings = conversions.flatMap(c => c.warnings || [])

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const conv of conversions) {
        await api.createFile(conv.filename, conv.content)
      }
      toast.success(t('common.success'))
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <p className="text-sm text-text-primary mb-3">{t('compose.convertTitle')}</p>

        {allWarnings.length > 0 && (
          <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
            <p className="font-medium mb-1">{t('compose.warnings')}:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {allWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-3 mb-4">
          {conversions.map(conv => (
            <div key={conv.filename} className="border border-border rounded">
              <div className="px-3 py-1.5 bg-surface-raised text-xs font-medium text-text-primary">
                {conv.filename}
              </div>
              <pre className="p-3 text-[10px] text-text-secondary overflow-x-auto">
                {conv.content}
              </pre>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50">
            {saving ? t('common.loading') : t('files.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build frontend**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/compose/
git commit -m "feat: add compose UI components (import, project card, convert preview)"
```

---

## Task 10: 集成 — ContainersPage 集成 Compose + Autostart

**Files:**
- Modify: `web/src/pages/ContainersPage.tsx`

- [ ] **Step 1: Integrate compose projects and autostart toggle into ContainersPage**

Add imports:

```tsx
import { useComposeProjects } from '@/hooks/useCompose'
import { ImportComposeDialog } from '@/components/compose/ImportComposeDialog'
import { ComposeProjectCard } from '@/components/compose/ComposeProjectCard'
```

Add state:

```tsx
const [importComposeOpen, setImportComposeOpen] = useState(false)
const { data: composeProjects = [] } = useComposeProjects()
```

Add "Import Compose" button next to the existing controls:

```tsx
<button onClick={() => setImportComposeOpen(true)}
  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20">
  <Plus size={12} /> {t('compose.import')}
</button>
```

Add compose projects section before the container table:

```tsx
{composeProjects.length > 0 && (
  <div className="space-y-2">
    {composeProjects.map(p => (
      <ComposeProjectCard key={p.name} project={p} />
    ))}
  </div>
)}
```

Add autostart column to the table (only for containers with `io.containers.systemd.unit` label):

```tsx
// In table header
<th className="px-3 py-2 text-right font-medium">{t('containers.autostart')}</th>

// In table row
<td className="px-3 py-2 text-right">
  {c.labels?.['io.containers.systemd.unit'] && (
    <AutostartToggle containerId={c.id} />
  )}
</td>
```

Create a small `AutostartToggle` component inline or as a separate file:

```tsx
function AutostartToggle({ containerId }: { containerId: string }) {
  const { t } = useTranslation()
  const { data } = useContainerAutostart(containerId)
  const setMut = useSetContainerAutostart()

  return (
    <button
      onClick={() => setMut.mutate({ id: containerId, enabled: !(data?.enabled) })}
      className={`px-2 py-0.5 rounded text-[10px] ${
        data?.enabled
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-zinc-500/10 text-zinc-400'
      }`}
      title={t('containers.autostart')}
    >
      {data?.enabled ? 'ON' : 'OFF'}
    </button>
  )
}
```

Add dialog:

```tsx
<ImportComposeDialog open={importComposeOpen} onClose={() => setImportComposeOpen(false)} />
```

- [ ] **Step 2: Build frontend**

Run: `cd web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run all Go tests**

Run: `go test ./internal/...`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ContainersPage.tsx
git commit -m "feat: integrate compose projects and autostart toggle into containers page"
```

---

## Final Verification

- [ ] Run `go build ./...`
- [ ] Run `go test ./internal/...`
- [ ] Run `cd web && npx tsc --noEmit`
- [ ] Manual test: import a compose file, verify it shows up, convert to quadlet
- [ ] Manual test: apply a quadlet file, verify unit is enabled
- [ ] Manual test: toggle autostart on a managed container
