# Quadlet Manager Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Quadlet Manager from a read-heavy dashboard into a full-featured Podman/Systemd orchestrator with container lifecycle management, Web Terminal, backup/restore, and alerts.

**Architecture:** Dual-track orchestrator routes Quadlet-managed containers through systemd D-Bus and orphan containers through Libpod API. Frontend migrates from Zustand-based data fetching to TanStack Query for server state. Auth/Settings modules are preserved as-is.

**Tech Stack:** Go (Gin), coreos/go-systemd/v22/dbus, godbus/dbus/v5, SQLite3, React 19, TanStack Query v5, shadcn/ui, xterm.js, CodeMirror 6

**Spec:** `docs/superpowers/specs/2026-05-17-manager-redesign-design.md`

---

## Phase 1: Backend Provider Layer

### Task 1: Expand PodmanProvider Interface

**Files:**
- Modify: `internal/provider/podman.go`
- Modify: `internal/model/container.go`

- [ ] **Step 1: Add new model types for inspect data**

Add to `internal/model/container.go`:

```go
// ContainerInspect holds detailed container info from Podman inspect.
type ContainerInspect struct {
	ID     string            `json:"Id"`
	Name   string            `json:"Name"`
	State  *ContainerState   `json:"State"`
	Labels map[string]string `json:"Labels"`
	Config *ContainerConfig  `json:"Config"`
}

type ContainerState struct {
	Status     string `json:"Status"`
	Running    bool   `json:"Running"`
	Paused     bool   `json:"Paused"`
	Restarting bool   `json:"Restarting"`
	OOMKilled  bool   `json:"OomKilled"`
	Dead       bool   `json:"Dead"`
	Pid        int    `json:"Pid"`
	ExitCode   int    `json:"ExitCode"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

type ContainerConfig struct {
	Image  string            `json:"Image"`
	Cmd    []string          `json:"Cmd"`
	Env    []string          `json:"Env"`
	Labels map[string]string `json:"Labels"`
}
```

- [ ] **Step 2: Rewrite the PodmanProvider interface**

Replace the contents of `internal/provider/podman.go` with:

```go
package provider

import (
	"context"
	"net"

	"github.com/choken/quadlet-manager/internal/model"
)

// PodmanProvider abstracts all Podman API operations.
type PodmanProvider interface {
	Connect(ctx context.Context) error
	Close()
	APIVersion() string

	// Container lifecycle
	ListContainers(ctx context.Context) ([]model.ContainerInfo, error)
	GetContainerStats(ctx context.Context, id string) (*model.ContainerStats, error)
	GetAllStats(ctx context.Context) ([]model.ContainerStats, error)
	GetContainerLogs(ctx context.Context, id string, tail int) ([]string, error)
	StartContainer(ctx context.Context, id string) error
	StopContainer(ctx context.Context, id string, timeout *int) error
	RestartContainer(ctx context.Context, id string, timeout *int) error
	PauseContainer(ctx context.Context, id string) error
	UnpauseContainer(ctx context.Context, id string) error
	RemoveContainer(ctx context.Context, id string, force bool) error
	InspectContainer(ctx context.Context, id string) (*model.ContainerInspect, error)

	// Container exec
	ExecCreate(ctx context.Context, containerID string, cmd []string, tty bool) (string, error)
	ExecAttach(ctx context.Context, execID string) (net.Conn, error)
	ExecResize(ctx context.Context, execID string, height, width uint) error

	// Images
	ListImages(ctx context.Context) ([]model.ImageInfo, error)
	PullImage(ctx context.Context, name string) (io.ReadCloser, error)
	RemoveImage(ctx context.Context, id string, force bool) error
	InspectImage(ctx context.Context, id string) (map[string]any, error)

	// Volumes
	ListVolumes(ctx context.Context) ([]model.VolumeInfo, error)
	CreateVolume(ctx context.Context, name string, labels map[string]string) (*model.VolumeInfo, error)
	RemoveVolume(ctx context.Context, name string, force bool) error
	InspectVolume(ctx context.Context, name string) (map[string]any, error)

	// Networks
	ListNetworks(ctx context.Context) ([]model.NetworkInfo, error)
	CreateNetwork(ctx context.Context, name, driver string, subnet string) error
	RemoveNetwork(ctx context.Context, name string) error
	InspectNetwork(ctx context.Context, name string) (map[string]any, error)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./internal/provider/`
Expected: compilation errors in `podman_socket.go` and `mock_podman.go` (expected — they don't implement the new interface yet)

- [ ] **Step 4: Commit**

```bash
git add internal/provider/podman.go internal/model/container.go
git commit -m "feat: expand PodmanProvider interface with lifecycle, exec, CRUD"
```

---

### Task 2: SocketPodmanProvider — API Version Detection + Container Lifecycle

**Files:**
- Modify: `internal/provider/podman_socket.go`

- [ ] **Step 1: Add API version detection and new struct fields**

Replace `internal/provider/podman_socket.go` with the expanded implementation. The key changes:

1. Add `apiVersion string` field to `SocketPodmanProvider`
2. `Connect()` calls `GET /libpod/info` and parses `Version.APIVersion`
3. All URL paths use `p.apiVersion` instead of hardcoded `v5.0.0`
4. Add `do()` helper method to reduce HTTP boilerplate
5. Add `doJSON()` helper for JSON responses

```go
package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/choken/quadlet-manager/internal/model"
)

type SocketPodmanProvider struct {
	socketPath string
	client     *http.Client
	apiVersion string
}

func NewSocketPodmanProvider(socketPath string) *SocketPodmanProvider {
	return &SocketPodmanProvider{socketPath: socketPath}
}

func (p *SocketPodmanProvider) Connect(_ context.Context) error {
	p.client = &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", p.socketPath)
			},
		},
		Timeout: 30 * time.Second,
	}

	// Detect API version
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/info")
	if err != nil {
		return fmt.Errorf("podman connect: %w", err)
	}
	defer resp.Body.Close()

	var info struct {
		Version struct {
			APIVersion string `json:"APIVersion"`
		} `json:"version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		// Fallback to v5.0.0 if info endpoint doesn't return version
		p.apiVersion = "v5.0.0"
		return nil
	}
	p.apiVersion = info.Version.APIVersion
	if p.apiVersion == "" {
		p.apiVersion = "v5.0.0"
	}
	return nil
}

func (p *SocketPodmanProvider) Close() {
	p.client = nil
}

func (p *SocketPodmanProvider) APIVersion() string {
	return p.apiVersion
}

// do executes an HTTP request against the Podman socket.
func (p *SocketPodmanProvider) do(method, path string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}
	url := fmt.Sprintf("http://localhost/%s/libpod%s", p.apiVersion, path)
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return p.client.Do(req)
}

// doJSON executes a request and decodes the JSON response into dst.
func (p *SocketPodmanProvider) doJSON(method, path string, body any, dst any) error {
	resp, err := p.do(method, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("podman %s %s: %s", method, path, string(msg))
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

func (p *SocketPodmanProvider) ListContainers(_ context.Context) ([]model.ContainerInfo, error) {
	var containers []model.ContainerInfo
	err := p.doJSON("GET", "/containers/json?all=true", nil, &containers)
	return containers, err
}

func (p *SocketPodmanProvider) GetContainerStats(_ context.Context, id string) (*model.ContainerStats, error) {
	var stats []model.ContainerStats
	err := p.doJSON("GET", fmt.Sprintf("/containers/%s/stats?stream=false", id), nil, &stats)
	if err != nil {
		return nil, err
	}
	if len(stats) == 0 {
		return nil, fmt.Errorf("no stats for container %s", id)
	}
	return &stats[0], nil
}

func (p *SocketPodmanProvider) GetAllStats(_ context.Context) ([]model.ContainerStats, error) {
	var stats []model.ContainerStats
	err := p.doJSON("GET", "/containers/stats?stream=false", nil, &stats)
	return stats, err
}

func (p *SocketPodmanProvider) GetContainerLogs(_ context.Context, id string, tail int) ([]string, error) {
	resp, err := p.do("GET", fmt.Sprintf("/containers/%s/logs?tail=%d&stdout=true&stderr=true", id, tail), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return strings.Split(string(data), "\n"), nil
}

func (p *SocketPodmanProvider) StartContainer(_ context.Context, id string) error {
	resp, err := p.do("POST", fmt.Sprintf("/containers/%s/start", id), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("start container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) StopContainer(_ context.Context, id string, timeout *int) error {
	path := fmt.Sprintf("/containers/%s/stop", id)
	if timeout != nil {
		path = fmt.Sprintf("%s?timeout=%d", path, *timeout)
	}
	resp, err := p.do("POST", path, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("stop container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) RestartContainer(_ context.Context, id string, timeout *int) error {
	path := fmt.Sprintf("/containers/%s/restart", id)
	if timeout != nil {
		path = fmt.Sprintf("%s?timeout=%d", path, *timeout)
	}
	resp, err := p.do("POST", path, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("restart container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) PauseContainer(_ context.Context, id string) error {
	resp, err := p.do("POST", fmt.Sprintf("/containers/%s/pause", id), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("pause container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) UnpauseContainer(_ context.Context, id string) error {
	resp, err := p.do("POST", fmt.Sprintf("/containers/%s/unpause", id), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("unpause container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) RemoveContainer(_ context.Context, id string, force bool) error {
	resp, err := p.do("DELETE", fmt.Sprintf("/containers/%s?force=%t", id, force), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("remove container %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) InspectContainer(_ context.Context, id string) (*model.ContainerInspect, error) {
	var inspect model.ContainerInspect
	err := p.doJSON("GET", fmt.Sprintf("/containers/%s/json", id), nil, &inspect)
	return &inspect, err
}

func (p *SocketPodmanProvider) ExecCreate(_ context.Context, containerID string, cmd []string, tty bool) (string, error) {
	body := map[string]any{
		"AttachStdin":  true,
		"AttachStdout": true,
		"AttachStderr": true,
		"Tty":          tty,
		"Cmd":          cmd,
	}
	var result struct {
		ID string `json:"Id"`
	}
	err := p.doJSON("POST", fmt.Sprintf("/containers/%s/exec", containerID), body, &result)
	return result.ID, err
}

func (p *SocketPodmanProvider) ExecAttach(_ context.Context, execID string) (net.Conn, error) {
	url := fmt.Sprintf("http://localhost/%s/libpod/exec/%s/start", p.apiVersion, execID)
	req, err := http.NewRequest("POST", url, bytes.NewReader([]byte(`{"Detach":false,"Tty":true}`)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	// Use raw TCP connection via hijack
	conn, err := net.Dial("unix", p.socketPath)
	if err != nil {
		return nil, fmt.Errorf("dial podman socket: %w", err)
	}

	// Send the HTTP request manually
	if err := req.Write(conn); err != nil {
		conn.Close()
		return nil, fmt.Errorf("write exec request: %w", err)
	}

	// Read until we find the end of HTTP headers (skip the HTTP response headers)
	buf := make([]byte, 4096)
	total := 0
	for {
		n, err := conn.Read(buf[total:])
		if err != nil {
			conn.Close()
			return nil, fmt.Errorf("read exec response: %w", err)
		}
		total += n
		// Look for end of HTTP headers
		if strings.Contains(string(buf[:total]), "\r\n\r\n") {
			break
		}
	}

	return conn, nil
}

func (p *SocketPodmanProvider) ExecResize(_ context.Context, execID string, height, width uint) error {
	body := map[string]any{"h": height, "w": width}
	resp, err := p.do("POST", fmt.Sprintf("/exec/%s/resize?h=%d&w=%d", execID, height, width), body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (p *SocketPodmanProvider) ListImages(_ context.Context) ([]model.ImageInfo, error) {
	var images []model.ImageInfo
	err := p.doJSON("GET", "/images/json", nil, &images)
	return images, err
}

func (p *SocketPodmanProvider) PullImage(_ context.Context, name string) (io.ReadCloser, error) {
	resp, err := p.do("POST", fmt.Sprintf("/images/pull?reference=%s", name), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		msg, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("pull image %s: %s", name, string(msg))
	}
	return resp.Body, nil
}

func (p *SocketPodmanProvider) RemoveImage(_ context.Context, id string, force bool) error {
	resp, err := p.do("DELETE", fmt.Sprintf("/images/%s?force=%t", id, force), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("remove image %s: status %d", id, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) InspectImage(_ context.Context, id string) (map[string]any, error) {
	var result map[string]any
	err := p.doJSON("GET", fmt.Sprintf("/images/%s/json", id), nil, &result)
	return result, err
}

func (p *SocketPodmanProvider) ListVolumes(_ context.Context) ([]model.VolumeInfo, error) {
	var resp struct {
		Volumes []model.VolumeInfo `json:"Volumes"`
	}
	err := p.doJSON("GET", "/volumes/json", nil, &resp)
	return resp.Volumes, err
}

func (p *SocketPodmanProvider) CreateVolume(_ context.Context, name string, labels map[string]string) (*model.VolumeInfo, error) {
	body := map[string]any{"Name": name}
	if len(labels) > 0 {
		body["Labels"] = labels
	}
	var vol model.VolumeInfo
	err := p.doJSON("POST", "/volumes/create", body, &vol)
	return &vol, err
}

func (p *SocketPodmanProvider) RemoveVolume(_ context.Context, name string, force bool) error {
	resp, err := p.do("DELETE", fmt.Sprintf("/volumes/%s?force=%t", name, force), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("remove volume %s: status %d", name, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) InspectVolume(_ context.Context, name string) (map[string]any, error) {
	var result map[string]any
	err := p.doJSON("GET", fmt.Sprintf("/volumes/%s/json", name), nil, &result)
	return result, err
}

func (p *SocketPodmanProvider) ListNetworks(_ context.Context) ([]model.NetworkInfo, error) {
	var networks []model.NetworkInfo
	err := p.doJSON("GET", "/networks/json", nil, &networks)
	return networks, err
}

func (p *SocketPodmanProvider) CreateNetwork(_ context.Context, name, driver string, subnet string) error {
	body := map[string]any{"Name": name}
	if driver != "" {
		body["Driver"] = driver
	}
	if subnet != "" {
		body["Subnets"] = []map[string]string{{"Subnet": subnet}}
	}
	resp, err := p.do("POST", "/networks/create", body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("create network %s: %s", name, string(msg))
	}
	return nil
}

func (p *SocketPodmanProvider) RemoveNetwork(_ context.Context, name string) error {
	resp, err := p.do("DELETE", fmt.Sprintf("/networks/%s", name), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("remove network %s: status %d", name, resp.StatusCode)
	}
	return nil
}

func (p *SocketPodmanProvider) InspectNetwork(_ context.Context, name string) (map[string]any, error) {
	var result map[string]any
	err := p.doJSON("GET", fmt.Sprintf("/networks/%s/json", name), nil, &result)
	return result, err
}

var _ PodmanProvider = (*SocketPodmanProvider)(nil)
```

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/provider/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/provider/podman_socket.go
git commit -m "feat: implement expanded SocketPodmanProvider with API version detection"
```

---

### Task 3: Update MockPodman for Testing

**Files:**
- Modify: `internal/provider/mock_podman.go`

- [ ] **Step 1: Add stub implementations for all new methods**

Add to `internal/provider/mock_podman.go` after the existing methods. Keep it minimal — just enough to satisfy the interface and allow tests to set up return values:

```go
// Add to MockPodman struct fields:
//   ExecSessions map[string]bool
//   InspectData  map[string]any

func (m *MockPodman) APIVersion() string { return "v5.0.0" }

func (m *MockPodman) StartContainer(_ context.Context, id string) error {
	for i, c := range m.Containers {
		if c.ID == id {
			m.Containers[i].State = "running"
			m.Containers[i].Status = "Up"
		}
	}
	return nil
}

func (m *MockPodman) StopContainer(_ context.Context, id string, _ *int) error {
	for i, c := range m.Containers {
		if c.ID == id {
			m.Containers[i].State = "exited"
			m.Containers[i].Status = "Exited"
		}
	}
	return nil
}

func (m *MockPodman) RestartContainer(_ context.Context, id string, _ *int) error {
	return m.StartContainer(context.Background(), id)
}

func (m *MockPodman) PauseContainer(_ context.Context, id string) error {
	for i, c := range m.Containers {
		if c.ID == id {
			m.Containers[i].State = "paused"
			m.Containers[i].Status = "Paused"
		}
	}
	return nil
}

func (m *MockPodman) UnpauseContainer(_ context.Context, id string) error {
	return m.StartContainer(context.Background(), id)
}

func (m *MockPodman) RemoveContainer(_ context.Context, id string, _ bool) error {
	for i, c := range m.Containers {
		if c.ID == id {
			m.Containers = append(m.Containers[:i], m.Containers[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("container %s not found", id)
}

func (m *MockPodman) InspectContainer(_ context.Context, id string) (*model.ContainerInspect, error) {
	for _, c := range m.Containers {
		if c.ID == id {
			return &model.ContainerInspect{
				ID:     c.ID,
				Name:   c.Names[0],
				Labels: map[string]string{},
				State:  &model.ContainerState{Status: c.State},
				Config: &model.ContainerConfig{Image: c.Image},
			}, nil
		}
	}
	return nil, fmt.Errorf("container %s not found", id)
}

func (m *MockPodman) ExecCreate(_ context.Context, _ string, _ []string, _ bool) (string, error) {
	return "mock-exec-id", nil
}

func (m *MockPodman) ExecAttach(_ context.Context, _ string) (net.Conn, error) {
	return nil, fmt.Errorf("mock: exec attach not supported")
}

func (m *MockPodman) ExecResize(_ context.Context, _ string, _, _ uint) error {
	return nil
}

func (m *MockPodman) PullImage(_ context.Context, _ string) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("mock pull complete")), nil
}

func (m *MockPodman) RemoveImage(_ context.Context, id string, _ bool) error {
	for i, img := range m.Images {
		if img.ID == id {
			m.Images = append(m.Images[:i], m.Images[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("image %s not found", id)
}

func (m *MockPodman) InspectImage(_ context.Context, _ string) (map[string]any, error) {
	return map[string]any{"mock": true}, nil
}

func (m *MockPodman) CreateVolume(_ context.Context, name string, _ map[string]string) (*model.VolumeInfo, error) {
	vol := model.VolumeInfo{Name: name, MountPoint: "/var/lib/volumes/" + name}
	m.Volumes = append(m.Volumes, vol)
	return &vol, nil
}

func (m *MockPodman) RemoveVolume(_ context.Context, name string, _ bool) error {
	for i, v := range m.Volumes {
		if v.Name == name {
			m.Volumes = append(m.Volumes[:i], m.Volumes[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("volume %s not found", name)
}

func (m *MockPodman) InspectVolume(_ context.Context, _ string) (map[string]any, error) {
	return map[string]any{"mock": true}, nil
}

func (m *MockPodman) CreateNetwork(_ context.Context, name string, _ string, _ string) error {
	m.Networks = append(m.Networks, model.NetworkInfo{Name: name, ID: "net-" + name})
	return nil
}

func (m *MockPodman) RemoveNetwork(_ context.Context, name string) error {
	for i, n := range m.Networks {
		if n.Name == name {
			m.Networks = append(m.Networks[:i], m.Networks[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("network %s not found", name)
}

func (m *MockPodman) InspectNetwork(_ context.Context, _ string) (map[string]any, error) {
	return map[string]any{"mock": true}, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/provider/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/provider/mock_podman.go
git commit -m "feat: extend MockPodman with lifecycle, exec, and CRUD stubs"
```

---

## Phase 2: Orchestrator + Services

### Task 4: D-Bus Timeout Wrapper

**Files:**
- Modify: `internal/provider/systemd_dbus.go`

- [ ] **Step 1: Add the withTimeout helper and wrap all methods**

Add the timeout constant and helper after the existing `const` block in `systemd_dbus.go`:

```go
const defaultDBusTimeout = 5 * time.Second

func (p *DBusSystemdProvider) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if _, ok := ctx.Deadline(); ok {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, defaultDBusTimeout)
}
```

Then wrap every public method that makes D-Bus calls. For example, `StartUnit`:

```go
func (p *DBusSystemdProvider) StartUnit(ctx context.Context, name string) error {
	ctx, cancel := p.withTimeout(ctx)
	defer cancel()
	return p.unitAction(ctx, "StartUnit", name)
}
```

Apply the same pattern to: `StopUnit`, `RestartUnit`, `DaemonReload`, `EnableUnit`, `DisableUnit`, `ListUnits`, `GetUnitStatus`. Add `"time"` to imports.

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/provider/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/provider/systemd_dbus.go
git commit -m "feat: add 5s timeout to all D-Bus provider methods"
```

---

### Task 5: ContainerOrchestrator

**Files:**
- Create: `internal/service/orchestrator.go`
- Create: `internal/service/orchestrator_test.go`

- [ ] **Step 1: Write the orchestrator**

Create `internal/service/orchestrator.go`:

```go
package service

import (
	"context"
	"fmt"

	"github.com/choken/quadlet-manager/internal/provider"
)

// ContainerOrchestrator routes container operations through the correct
// provider: systemd D-Bus for Quadlet-managed containers, Libpod API for orphans.
type ContainerOrchestrator struct {
	systemd provider.SystemdProvider
	podman  provider.PodmanProvider
}

func NewContainerOrchestrator(systemd provider.SystemdProvider, podman provider.PodmanProvider) *ContainerOrchestrator {
	return &ContainerOrchestrator{systemd: systemd, podman: podman}
}

// IsManaged checks if a container is Quadlet-managed by inspecting its labels.
// Returns (isManaged, unitName, error).
func (o *ContainerOrchestrator) IsManaged(ctx context.Context, containerID string) (bool, string, error) {
	info, err := o.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return false, "", fmt.Errorf("inspect container %s: %w", containerID, err)
	}

	if info.Labels != nil {
		if unit, ok := info.Labels["io.containers.systemd.unit"]; ok && unit != "" {
			return true, unit, nil
		}
	}
	return false, "", nil
}

// Start starts a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Start(ctx context.Context, containerID string) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.StartUnit(ctx, unitName)
	}
	return o.podman.StartContainer(ctx, containerID)
}

// Stop stops a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Stop(ctx context.Context, containerID string, timeout *int) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.StopUnit(ctx, unitName)
	}
	return o.podman.StopContainer(ctx, containerID, timeout)
}

// Restart restarts a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Restart(ctx context.Context, containerID string, timeout *int) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.RestartUnit(ctx, unitName)
	}
	return o.podman.RestartContainer(ctx, containerID, timeout)
}

// Remove removes a container. Quadlet-managed containers are stopped via systemd first.
func (o *ContainerOrchestrator) Remove(ctx context.Context, containerID string, force bool) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		// Stop via systemd first, then remove via Podman
		if err := o.systemd.StopUnit(ctx, unitName); err != nil && !force {
			return err
		}
	}
	return o.podman.RemoveContainer(ctx, containerID, force)
}
```

- [ ] **Step 2: Write the failing test**

Create `internal/service/orchestrator_test.go`:

```go
package service

import (
	"context"
	"testing"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

func TestOrchestrator_IsManaged(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "managed-1", Names: []string{"nginx"}, Image: "nginx:latest", State: "running"},
			{ID: "orphan-1", Names: []string{"debug"}, Image: "alpine", State: "running"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	// MockPodman.InspectContainer returns empty labels by default,
	// so all containers are "orphan" unless we customize the mock.
	// For now, test the orphan path.
	managed, _, err := orch.IsManaged(context.Background(), "orphan-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if managed {
		t.Error("expected orphan-1 to not be managed")
	}
}

func TestOrchestrator_Start_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "exited"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Start(context.Background(), "c1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify container was started via Podman
	if podman.Containers[0].State != "running" {
		t.Errorf("expected state running, got %s", podman.Containers[0].State)
	}
}

func TestOrchestrator_Stop_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "running"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Stop(context.Background(), "c1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if podman.Containers[0].State != "exited" {
		t.Errorf("expected state exited, got %s", podman.Containers[0].State)
	}
}
```

- [ ] **Step 3: Run the test**

Run: `go test ./internal/service/ -run TestOrchestrator -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/service/orchestrator.go internal/service/orchestrator_test.go
git commit -m "feat: add ContainerOrchestrator with dual-track routing"
```

---

### Task 6: ImageService, VolumeService, NetworkService

**Files:**
- Create: `internal/service/image_service.go`
- Create: `internal/service/volume_service.go`
- Create: `internal/service/network_service.go`

- [ ] **Step 1: Create ImageService**

Create `internal/service/image_service.go`:

```go
package service

import (
	"context"
	"io"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type ImageService struct {
	podman provider.PodmanProvider
}

func NewImageService(podman provider.PodmanProvider) *ImageService {
	return &ImageService{podman: podman}
}

func (s *ImageService) ListImages(ctx context.Context) ([]model.ImageInfo, error) {
	return s.podman.ListImages(ctx)
}

func (s *ImageService) PullImage(ctx context.Context, name string) (io.ReadCloser, error) {
	return s.podman.PullImage(ctx, name)
}

func (s *ImageService) RemoveImage(ctx context.Context, id string, force bool) error {
	return s.podman.RemoveImage(ctx, id, force)
}

func (s *ImageService) InspectImage(ctx context.Context, id string) (map[string]any, error) {
	return s.podman.InspectImage(ctx, id)
}
```

- [ ] **Step 2: Create VolumeService**

Create `internal/service/volume_service.go`:

```go
package service

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type VolumeService struct {
	podman provider.PodmanProvider
}

func NewVolumeService(podman provider.PodmanProvider) *VolumeService {
	return &VolumeService{podman: podman}
}

func (s *VolumeService) ListVolumes(ctx context.Context) ([]model.VolumeInfo, error) {
	return s.podman.ListVolumes(ctx)
}

func (s *VolumeService) CreateVolume(ctx context.Context, name string, labels map[string]string) (*model.VolumeInfo, error) {
	return s.podman.CreateVolume(ctx, name, labels)
}

func (s *VolumeService) RemoveVolume(ctx context.Context, name string, force bool) error {
	return s.podman.RemoveVolume(ctx, name, force)
}

func (s *VolumeService) InspectVolume(ctx context.Context, name string) (map[string]any, error) {
	return s.podman.InspectVolume(ctx, name)
}
```

- [ ] **Step 3: Create NetworkService**

Create `internal/service/network_service.go`:

```go
package service

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type NetworkService struct {
	podman provider.PodmanProvider
}

func NewNetworkService(podman provider.PodmanProvider) *NetworkService {
	return &NetworkService{podman: podman}
}

func (s *NetworkService) ListNetworks(ctx context.Context) ([]model.NetworkInfo, error) {
	return s.podman.ListNetworks(ctx)
}

func (s *NetworkService) CreateNetwork(ctx context.Context, name, driver, subnet string) error {
	return s.podman.CreateNetwork(ctx, name, driver, subnet)
}

func (s *NetworkService) RemoveNetwork(ctx context.Context, name string) error {
	return s.podman.RemoveNetwork(ctx, name)
}

func (s *NetworkService) InspectNetwork(ctx context.Context, name string) (map[string]any, error) {
	return s.podman.InspectNetwork(ctx, name)
}
```

- [ ] **Step 4: Verify compilation**

Run: `go build ./internal/service/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/service/image_service.go internal/service/volume_service.go internal/service/network_service.go
git commit -m "feat: add ImageService, VolumeService, NetworkService"
```

---

### Task 7: BackupService

**Files:**
- Create: `internal/service/backup_service.go`

- [ ] **Step 1: Create the backup service**

Create `internal/service/backup_service.go`:

```go
package service

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/choken/quadlet-manager/internal/provider"
)

type BackupService struct {
	quadletFS  provider.QuadletFS
	quadletDir string
	settings   SettingsLookup
	userID     int64
}

func NewBackupService(fs provider.QuadletFS, quadletDir string, settings SettingsLookup) *BackupService {
	return &BackupService{quadletFS: fs, quadletDir: quadletDir, settings: settings}
}

// Export creates a tar.gz of all quadlet files + settings.
func (s *BackupService) Export(ctx context.Context, userID int64) ([]byte, error) {
	files, err := s.quadletFS.ScanDir(ctx)
	if err != nil {
		return nil, fmt.Errorf("scan quadlet dir: %w", err)
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	// Add quadlet files
	for _, f := range files {
		header := &tar.Header{
			Name: f.Name,
			Mode: 0644,
			Size: int64(len(f.Content)),
		}
		if err := tw.WriteHeader(header); err != nil {
			return nil, err
		}
		if _, err := tw.Write([]byte(f.Content)); err != nil {
			return nil, err
		}
	}

	// Add settings (no auth data)
	if s.settings != nil {
		settings, err := s.settings.GetByUserID(userID)
		if err == nil && settings != nil {
			settingsJSON, _ := json.MarshalIndent(settings, "", "  ")
			header := &tar.Header{
				Name: "settings.json",
				Mode: 0644,
				Size: int64(len(settingsJSON)),
			}
			if err := tw.WriteHeader(header); err != nil {
				return nil, err
			}
			tw.Write(settingsJSON)
		}
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Import extracts a tar.gz into the quadlet directory.
func (s *BackupService) Import(ctx context.Context, data []byte) error {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("invalid gzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	validExts := []string{".container", ".volume", ".network", ".pod", ".kube", ".image"}

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read tar: %w", err)
		}

		name := filepath.Base(header.Name)
		if name != header.Name {
			return fmt.Errorf("invalid filename (directory traversal): %s", header.Name)
		}

		// Skip settings.json, only import quadlet files
		if name == "settings.json" {
			continue
		}

		// Validate extension
		ext := filepath.Ext(name)
		valid := false
		for _, v := range validExts {
			if ext == v {
				valid = true
				break
			}
		}
		if !valid {
			continue
		}

		content, err := io.ReadAll(tr)
		if err != nil {
			return fmt.Errorf("read file %s: %w", name, err)
		}

		if err := s.quadletFS.WriteFile(ctx, name, string(content)); err != nil {
			return fmt.Errorf("write file %s: %w", name, err)
		}
	}
	return nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/service/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/service/backup_service.go
git commit -m "feat: add BackupService with tar.gz export/import"
```

---

## Phase 3: Handlers + Routes

### Task 8: Expand ContainerHandler

**Files:**
- Modify: `internal/handler/container_handler.go`

- [ ] **Step 1: Add lifecycle and inspect handlers**

Replace `internal/handler/container_handler.go` with the expanded version. The key changes:

1. Change struct to hold `*service.ContainerService` and `*service.ContainerOrchestrator`
2. Add handler methods: `StartContainer`, `StopContainer`, `RestartContainer`, `PauseContainer`, `UnpauseContainer`, `RemoveContainer`, `InspectContainer`
3. Keep existing methods: `ListContainers`, `GetContainerLogs`, `ListImages`, `ListVolumes`, `ListNetworks`

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type ContainerHandler struct {
	containers  *service.ContainerService
	orchestrator *service.ContainerOrchestrator
}

func NewContainerHandler(containers *service.ContainerService, orchestrator *service.ContainerOrchestrator) *ContainerHandler {
	return &ContainerHandler{containers: containers, orchestrator: orchestrator}
}

func (h *ContainerHandler) ListContainers(c *gin.Context) {
	containers, err := h.containers.ListContainers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, containers)
}

func (h *ContainerHandler) GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	tail := 100
	if t := c.Query("tail"); t != "" {
		if v, err := strconv.Atoi(t); err == nil {
			tail = v
		}
	}
	logs, err := h.containers.GetContainerLogs(c.Request.Context(), id, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "logs": logs})
}

func (h *ContainerHandler) StartContainer(c *gin.Context) {
	if err := h.orchestrator.Start(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (h *ContainerHandler) StopContainer(c *gin.Context) {
	if err := h.orchestrator.Stop(c.Request.Context(), c.Param("id"), nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (h *ContainerHandler) RestartContainer(c *gin.Context) {
	if err := h.orchestrator.Restart(c.Request.Context(), c.Param("id"), nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restarted"})
}

func (h *ContainerHandler) PauseContainer(c *gin.Context) {
	if err := h.containers.PauseContainer(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (h *ContainerHandler) UnpauseContainer(c *gin.Context) {
	if err := h.containers.UnpauseContainer(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "unpaused"})
}

func (h *ContainerHandler) RemoveContainer(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.orchestrator.Remove(c.Request.Context(), c.Param("id"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ContainerHandler) InspectContainer(c *gin.Context) {
	info, err := h.containers.InspectContainer(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *ContainerHandler) ListImages(c *gin.Context) {
	images, err := h.containers.ListImages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

func (h *ContainerHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.containers.ListVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volumes)
}

func (h *ContainerHandler) ListNetworks(c *gin.Context) {
	networks, err := h.containers.ListNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}
```

Note: The `ContainerService` also needs `PauseContainer`, `UnpauseContainer`, `InspectContainer` methods added. These are simple passthroughs to the podman provider — add them to `internal/service/container_service.go`.

- [ ] **Step 2: Add missing methods to ContainerService**

Add to `internal/service/container_service.go`:

```go
func (s *ContainerService) PauseContainer(ctx context.Context, id string) error {
	return s.podman.PauseContainer(ctx, id)
}

func (s *ContainerService) UnpauseContainer(ctx context.Context, id string) error {
	return s.podman.UnpauseContainer(ctx, id)
}

func (s *ContainerService) InspectContainer(ctx context.Context, id string) (*model.ContainerInspect, error) {
	return s.podman.InspectContainer(ctx, id)
}
```

- [ ] **Step 3: Verify compilation**

Run: `go build ./internal/handler/`
Expected: PASS (will fail until main.go wiring is updated — that's OK)

- [ ] **Step 4: Commit**

```bash
git add internal/handler/container_handler.go internal/service/container_service.go
git commit -m "feat: expand ContainerHandler with lifecycle, inspect, and orchestrator"
```

---

### Task 9: ImageHandler, VolumeHandler, NetworkHandler

**Files:**
- Create: `internal/handler/image_handler.go`
- Create: `internal/handler/volume_handler.go`
- Create: `internal/handler/network_handler.go`

- [ ] **Step 1: Create ImageHandler**

Create `internal/handler/image_handler.go`:

```go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ImageHandler struct {
	images *service.ImageService
	hub    *ws.Hub
}

func NewImageHandler(images *service.ImageService, hub *ws.Hub) *ImageHandler {
	return &ImageHandler{images: images, hub: hub}
}

func (h *ImageHandler) ListImages(c *gin.Context) {
	images, err := h.images.ListImages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

func (h *ImageHandler) PullImage(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	taskID := uuid.New().String()
	c.JSON(http.StatusOK, gin.H{"task_id": taskID})

	// Stream pull progress in background
	go func() {
		reader, err := h.images.PullImage(c.Request.Context(), req.Name)
		if err != nil {
			h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: map[string]any{
				"task_id": taskID, "status": "error", "error": err.Error(),
			}})
			return
		}
		defer reader.Close()

		decoder := json.NewDecoder(reader)
		for {
			var progress map[string]any
			if err := decoder.Decode(&progress); err != nil {
				break
			}
			progress["task_id"] = taskID
			progress["type"] = "pull_progress"
			h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: progress})
		}

		h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: map[string]any{
			"task_id": taskID, "status": "complete",
		}})
	}()
}

func (h *ImageHandler) RemoveImage(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.images.RemoveImage(c.Request.Context(), c.Param("id"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ImageHandler) InspectImage(c *gin.Context) {
	info, err := h.images.InspectImage(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
```

- [ ] **Step 2: Create VolumeHandler**

Create `internal/handler/volume_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type VolumeHandler struct {
	volumes *service.VolumeService
}

func NewVolumeHandler(volumes *service.VolumeService) *VolumeHandler {
	return &VolumeHandler{volumes: volumes}
}

func (h *VolumeHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.volumes.ListVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volumes)
}

func (h *VolumeHandler) CreateVolume(c *gin.Context) {
	var req struct {
		Name   string            `json:"name" binding:"required"`
		Labels map[string]string `json:"labels"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	vol, err := h.volumes.CreateVolume(c.Request.Context(), req.Name, req.Labels)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, vol)
}

func (h *VolumeHandler) RemoveVolume(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.volumes.RemoveVolume(c.Request.Context(), c.Param("name"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *VolumeHandler) InspectVolume(c *gin.Context) {
	info, err := h.volumes.InspectVolume(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
```

- [ ] **Step 3: Create NetworkHandler**

Create `internal/handler/network_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type NetworkHandler struct {
	networks *service.NetworkService
}

func NewNetworkHandler(networks *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{networks: networks}
}

func (h *NetworkHandler) ListNetworks(c *gin.Context) {
	networks, err := h.networks.ListNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}

func (h *NetworkHandler) CreateNetwork(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		Driver string `json:"driver"`
		Subnet string `json:"subnet"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.networks.CreateNetwork(c.Request.Context(), req.Name, req.Driver, req.Subnet); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created", "name": req.Name})
}

func (h *NetworkHandler) RemoveNetwork(c *gin.Context) {
	if err := h.networks.RemoveNetwork(c.Request.Context(), c.Param("name")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *NetworkHandler) InspectNetwork(c *gin.Context) {
	info, err := h.networks.InspectNetwork(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
```

- [ ] **Step 4: Verify compilation**

Run: `go build ./internal/handler/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/handler/image_handler.go internal/handler/volume_handler.go internal/handler/network_handler.go
git commit -m "feat: add ImageHandler, VolumeHandler, NetworkHandler"
```

---

### Task 10: ExecHandler (Web Terminal)

**Files:**
- Create: `internal/handler/exec_handler.go`

- [ ] **Step 1: Create the exec handler**

Create `internal/handler/exec_handler.go`:

```go
package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var execUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type ExecHandler struct {
	podman provider.PodmanProvider
}

func NewExecHandler(podman provider.PodmanProvider) *ExecHandler {
	return &ExecHandler{podman: podman}
}

// ExecCreate creates a new exec session and returns the exec_id.
func (h *ExecHandler) ExecCreate(c *gin.Context) {
	containerID := c.Param("id")
	var req struct {
		Cmd []string `json:"cmd"`
	}
	if err := c.BindJSON(&req); err != nil || len(req.Cmd) == 0 {
		req.Cmd = []string{"/bin/sh"}
	}

	execID, err := h.podman.ExecCreate(c.Request.Context(), containerID, req.Cmd, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exec_id": execID})
}

// ExecWebSocket upgrades to WebSocket and bridges to the Podman exec session.
func (h *ExecHandler) ExecWebSocket(c *gin.Context) {
	execID := c.Param("exec_id")

	wsConn, err := execUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("exec ws upgrade: %v", err)
		return
	}
	defer wsConn.Close()

	podmanConn, err := h.podman.ExecAttach(c.Request.Context(), execID)
	if err != nil {
		wsConn.WriteMessage(websocket.TextMessage, []byte("exec attach failed: "+err.Error()))
		return
	}
	defer podmanConn.Close()

	done := make(chan struct{}, 2)

	// WebSocket → Podman (user input + resize)
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			msgType, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if msgType == websocket.TextMessage && isResizeMessage(msg) {
				cols, rows := parseResize(msg)
				h.podman.ExecResize(c.Request.Context(), execID, rows, cols)
				continue
			}
			podmanConn.Write(msg)
		}
	}()

	// Podman → WebSocket (terminal output)
	go func() {
		defer func() { done <- struct{}{} }()
		buf := make([]byte, 32*1024)
		for {
			n, err := podmanConn.Read(buf)
			if err != nil {
				return
			}
			if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				return
			}
		}
	}()

	<-done
}

// isResizeMessage checks if a WebSocket message is a terminal resize command.
func isResizeMessage(msg []byte) bool {
	return len(msg) > 0 && msg[0] == '{' && strings.Contains(string(msg), `"type":"resize"`)
}

// parseResize extracts cols and rows from a resize message.
func parseResize(msg []byte) (cols, rows uint) {
	var r struct {
		Type string `json:"type"`
		Cols uint   `json:"cols"`
		Rows uint   `json:"rows"`
	}
	json.Unmarshal(msg, &r)
	return r.Cols, r.Rows
}
```

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/handler/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/handler/exec_handler.go
git commit -m "feat: add ExecHandler with WebSocket exec attach and resize"
```

---

### Task 11: BackupHandler

**Files:**
- Create: `internal/handler/backup_handler.go`

- [ ] **Step 1: Create the backup handler**

Create `internal/handler/backup_handler.go`:

```go
package handler

import (
	"io"
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type BackupHandler struct {
	backup *service.BackupService
}

func NewBackupHandler(backup *service.BackupService) *BackupHandler {
	return &BackupHandler{backup: backup}
}

func (h *BackupHandler) ExportBackup(c *gin.Context) {
	userID := c.GetInt64("user_id")
	data, err := h.backup.Export(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=quadlet-backup.tar.gz")
	c.Header("Content-Type", "application/gzip")
	c.Data(http.StatusOK, "application/gzip", data)
}

func (h *BackupHandler) ImportBackup(c *gin.Context) {
	file, _, err := c.Request.FormFile("backup")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing backup file"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.backup.Import(c.Request.Context(), data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restored"})
}
```

- [ ] **Step 2: Verify compilation**

Run: `go build ./internal/handler/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add internal/handler/backup_handler.go
git commit -m "feat: add BackupHandler with export/import endpoints"
```

---

### Task 12: Wire Everything in main.go

**Files:**
- Modify: `cmd/quadlet-manager/main.go`

- [ ] **Step 1: Update main.go with new services, handlers, and routes**

Key changes to `cmd/quadlet-manager/main.go`:

1. **Service wiring** — add after existing services:
```go
orchestrator := service.NewContainerOrchestrator(systemdProvider, podmanProvider)
imageSvc := service.NewImageService(podmanProvider)
volumeSvc := service.NewVolumeService(podmanProvider)
networkSvc := service.NewNetworkService(podmanProvider)
backupSvc := service.NewBackupService(quadletFS, cfg.QuadletDir, settingsStore)
```

2. **Handler wiring** — update existing and add new:
```go
containerH := handler.NewContainerHandler(containerSvc, orchestrator) // updated constructor
imageH := handler.NewImageHandler(imageSvc, hub)
volumeH := handler.NewVolumeHandler(volumeSvc)
networkH := handler.NewNetworkHandler(networkSvc)
execH := handler.NewExecHandler(podmanProvider)
backupH := handler.NewBackupHandler(backupSvc)
```

3. **Route registration** — add to the protected route group:
```go
// Container lifecycle
protected.POST("/containers/:id/start", containerH.StartContainer)
protected.POST("/containers/:id/stop", containerH.StopContainer)
protected.POST("/containers/:id/restart", containerH.RestartContainer)
protected.POST("/containers/:id/pause", containerH.PauseContainer)
protected.POST("/containers/:id/unpause", containerH.UnpauseContainer)
protected.DELETE("/containers/:id", containerH.RemoveContainer)
protected.GET("/containers/:id/inspect", containerH.InspectContainer)

// Images
protected.GET("/images", imageH.ListImages)
protected.POST("/images/pull", imageH.PullImage)
protected.DELETE("/images/:id", imageH.RemoveImage)
protected.GET("/images/:id/inspect", imageH.InspectImage)

// Volumes
protected.GET("/volumes", volumeH.ListVolumes)
protected.POST("/volumes", volumeH.CreateVolume)
protected.DELETE("/volumes/:name", volumeH.RemoveVolume)
protected.GET("/volumes/:name/inspect", volumeH.InspectVolume)

// Networks
protected.GET("/networks", networkH.ListNetworks)
protected.POST("/networks", networkH.CreateNetwork)
protected.DELETE("/networks/:name", networkH.RemoveNetwork)
protected.GET("/networks/:name/inspect", networkH.InspectNetwork)

// Exec
protected.POST("/containers/:id/exec", execH.ExecCreate)

// Backup
protected.GET("/backup/export", backupH.ExportBackup)
protected.POST("/backup/import", backupH.ImportBackup)
```

4. **Exec WebSocket** — add outside protected group (with token query param auth):
```go
r.GET("/api/v1/containers/:id/exec/:exec_id/ws", execH.ExecWebSocket)
```

5. **Remove old routes** that are now replaced:
- Remove `protected.GET("/containers/images", ...)` (moved to `/images`)
- Remove `protected.GET("/containers/volumes", ...)` (moved to `/volumes`)
- Remove `protected.GET("/containers/networks", ...)` (moved to `/networks`)

- [ ] **Step 2: Verify compilation**

Run: `go build ./cmd/quadlet-manager/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add cmd/quadlet-manager/main.go
git commit -m "feat: wire orchestrator, new services/handlers, and routes"
```

---

## Phase 4: Frontend — TanStack Query Migration

### Task 13: Install Frontend Dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd web && pnpm add @tanstack/react-query @xterm/xterm @xterm/addon-fit @xterm/addon-web-links sonner
```

- [ ] **Step 2: Verify build still works**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "feat: add TanStack Query, xterm.js, sonner dependencies"
```

---

### Task 14: TanStack Query Provider + QueryClient

**Files:**
- Create: `web/src/providers/QueryProvider.tsx`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Create QueryProvider**

Create `web/src/providers/QueryProvider.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Wrap App with QueryProvider**

Modify `web/src/main.tsx` to wrap `<App />` with `<QueryProvider>`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryProvider } from '@/providers/QueryProvider'
import App from './App'
import '@/i18n'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify build**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/providers/QueryProvider.tsx web/src/main.tsx
git commit -m "feat: add TanStack Query provider"
```

---

### Task 15: TanStack Query Hooks for All Resources

**Files:**
- Create: `web/src/hooks/useContainers.ts`
- Create: `web/src/hooks/useImages.ts`
- Create: `web/src/hooks/useVolumes.ts`
- Create: `web/src/hooks/useNetworks.ts`
- Create: `web/src/hooks/useUnits.ts`
- Modify: `web/src/api/client.ts` (add new API methods)

- [ ] **Step 1: Update API client with new endpoints**

Add to the `api` object in `web/src/api/client.ts`:

```typescript
// Container lifecycle
startContainer: (id: string) => request(`/containers/${id}/start`, { method: 'POST' }),
stopContainer: (id: string) => request(`/containers/${id}/stop`, { method: 'POST' }),
restartContainer: (id: string) => request(`/containers/${id}/restart`, { method: 'POST' }),
pauseContainer: (id: string) => request(`/containers/${id}/pause`, { method: 'POST' }),
unpauseContainer: (id: string) => request(`/containers/${id}/unpause`, { method: 'POST' }),
removeContainer: (id: string, force = false) => request(`/containers/${id}?force=${force}`, { method: 'DELETE' }),
inspectContainer: (id: string) => request<any>(`/containers/${id}/inspect`),

// Exec
execCreate: (id: string, cmd?: string[]) => request<{ exec_id: string }>(`/containers/${id}/exec`, {
  method: 'POST', body: JSON.stringify({ cmd: cmd || ['/bin/sh'] }),
}),

// Images
pullImage: (name: string) => request<{ task_id: string }>('/images/pull', {
  method: 'POST', body: JSON.stringify({ name }),
}),
removeImage: (id: string, force = false) => request(`/images/${id}?force=${force}`, { method: 'DELETE' }),
inspectImage: (id: string) => request<any>(`/images/${id}/inspect`),

// Volumes
createVolume: (name: string, labels?: Record<string, string>) => request<any>('/volumes', {
  method: 'POST', body: JSON.stringify({ name, labels }),
}),
removeVolume: (name: string, force = false) => request(`/volumes/${name}?force=${force}`, { method: 'DELETE' }),
inspectVolume: (name: string) => request<any>(`/volumes/${name}/inspect`),

// Networks
createNetwork: (name: string, driver?: string, subnet?: string) => request('/networks', {
  method: 'POST', body: JSON.stringify({ name, driver, subnet }),
}),
removeNetwork: (name: string) => request(`/networks/${name}`, { method: 'DELETE' }),
inspectNetwork: (name: string) => request<any>(`/networks/${name}/inspect`),

// Backup
exportBackup: () => request<Blob>('/backup/export'),
importBackup: (formData: FormData) => request('/backup/import', { method: 'POST', body: formData }),
```

Also update `listImages`, `listVolumes`, `listNetworks` to use the new paths:
```typescript
listImages: () => request<ImageInfo[]>('/images'),
listVolumes: () => request<VolumeInfo[]>('/volumes'),
listNetworks: () => request<NetworkInfo[]>('/networks'),
```

- [ ] **Step 2: Create useContainers hook**

Create `web/src/hooks/useContainers.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useContainers() {
  return useQuery({
    queryKey: ['containers'],
    queryFn: api.listContainers,
    refetchInterval: 10_000,
  })
}

export function useContainerStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 3_000,
  })
}

export function useStartContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.startContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useStopContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.stopContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useRestartContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.restartContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function usePauseContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.pauseContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useRemoveContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.removeContainer(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useExecCreate() {
  return useMutation({
    mutationFn: (id: string) => api.execCreate(id),
  })
}
```

- [ ] **Step 3: Create useImages hook**

Create `web/src/hooks/useImages.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useImages() {
  return useQuery({
    queryKey: ['images'],
    queryFn: api.listImages,
    refetchInterval: 30_000,
  })
}

export function usePullImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.pullImage(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['images'] }),
  })
}

export function useRemoveImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.removeImage(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['images'] }),
  })
}
```

- [ ] **Step 4: Create useVolumes hook**

Create `web/src/hooks/useVolumes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useVolumes() {
  return useQuery({
    queryKey: ['volumes'],
    queryFn: api.listVolumes,
    refetchInterval: 30_000,
  })
}

export function useCreateVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, labels }: { name: string; labels?: Record<string, string> }) =>
      api.createVolume(name, labels),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volumes'] }),
  })
}

export function useRemoveVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) => api.removeVolume(name, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volumes'] }),
  })
}
```

- [ ] **Step 5: Create useNetworks hook**

Create `web/src/hooks/useNetworks.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: api.listNetworks,
    refetchInterval: 30_000,
  })
}

export function useCreateNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, driver, subnet }: { name: string; driver?: string; subnet?: string }) =>
      api.createNetwork(name, driver, subnet),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}

export function useRemoveNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.removeNetwork(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}
```

- [ ] **Step 6: Create useUnits hook**

Create `web/src/hooks/useUnits.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: api.listUnits,
    refetchInterval: 10_000,
  })
}

export function useStartUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.startUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useStopUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.stopUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useRestartUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.restartUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useDaemonReload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.daemonReload(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}
```

- [ ] **Step 7: Verify build**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/hooks/ web/src/api/client.ts
git commit -m "feat: add TanStack Query hooks for all resources"
```

---

## Phase 5: Frontend — Page Upgrades

### Task 16: ContainersPage — Full Management

**Files:**
- Modify: `web/src/pages/ContainersPage.tsx`

- [ ] **Step 1: Rewrite ContainersPage with full management**

Replace `web/src/pages/ContainersPage.tsx` with a full management page. Key features:
- Uses `useContainers()` and `useContainerStats()` hooks
- Table columns: Name, Image, State (badge), CPU%, MEM%, Actions
- Row actions: Start/Stop/Restart (conditional), Pause, Remove (AlertDialog), Logs, Terminal
- Search filter and state filter
- Toast notifications on success/error

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { RefreshCw, Play, Square, RotateCw, Pause, Trash2, Terminal, FileText } from 'lucide-react'
import {
  useContainers, useContainerStats,
  useStartContainer, useStopContainer, useRestartContainer,
  usePauseContainer, useRemoveContainer, useExecCreate,
} from '@/hooks/useContainers'
import { toast } from 'sonner'

export function ContainersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: containers = [], isLoading, error, refetch } = useContainers()
  const { data: stats } = useContainerStats()
  const startMut = useStartContainer()
  const stopMut = useStopContainer()
  const restartMut = useRestartContainer()
  const pauseMut = usePauseContainer()
  const removeMut = useRemoveContainer()
  const execMut = useExecCreate()

  const statsMap = new Map((stats?.containers || []).map(s => [s.id, s]))

  const filtered = containers.filter(c => {
    const name = c.names?.[0] || ''
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
    const matchesState = stateFilter === 'all' || c.state === stateFilter
    return matchesSearch && matchesState
  })

  const handleAction = async (action: () => Promise<any>, label: string) => {
    try {
      await action()
      toast.success(label)
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    }
  }

  const handleTerminal = async (id: string) => {
    try {
      const { exec_id } = await execMut.mutateAsync(id)
      navigate(`/containers/${id}/exec/${exec_id}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create exec session')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.containers')}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary w-40"
          />
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary"
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="exited">Exited</option>
            <option value="paused">Paused</option>
          </select>
          <button onClick={() => refetch()} className="p-1 text-text-secondary hover:text-text-primary">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 rounded px-3 py-2 text-xs text-red-400">
          {error.message}
        </div>
      )}

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-raised text-text-secondary">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Image</th>
              <th className="px-3 py-2 text-left font-medium">State</th>
              <th className="px-3 py-2 text-right font-medium">CPU%</th>
              <th className="px-3 py-2 text-right font-medium">MEM</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => {
              const name = c.names?.[0] || '-'
              const s = statsMap.get(c.id)
              const isRunning = c.state === 'running'
              return (
                <tr key={c.id} className="hover:bg-surface-raised/50">
                  <td className="px-3 py-2 text-text-primary font-mono">{name}</td>
                  <td className="px-3 py-2 text-text-secondary">{c.image}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isRunning ? 'bg-emerald-500/10 text-emerald-400' :
                      c.state === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {c.state}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {s ? `${s.cpuPercent.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {s ? formatBytes(s.memUsage) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRunning ? (
                        <>
                          <button onClick={() => handleAction(() => stopMut.mutateAsync(c.id), 'Stopped')}
                            className="p-1 text-text-secondary hover:text-red-400" title="Stop">
                            <Square size={12} />
                          </button>
                          <button onClick={() => handleAction(() => restartMut.mutateAsync(c.id), 'Restarted')}
                            className="p-1 text-text-secondary hover:text-blue-400" title="Restart">
                            <RotateCw size={12} />
                          </button>
                          <button onClick={() => handleAction(() => pauseMut.mutateAsync(c.id), 'Paused')}
                            className="p-1 text-text-secondary hover:text-yellow-400" title="Pause">
                            <Pause size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleAction(() => startMut.mutateAsync(c.id), 'Started')}
                          className="p-1 text-text-secondary hover:text-emerald-400" title="Start">
                          <Play size={12} />
                        </button>
                      )}
                      <button onClick={() => handleTerminal(c.id)}
                        className="p-1 text-text-secondary hover:text-blue-400" title="Terminal">
                        <Terminal size={12} />
                      </button>
                      <button onClick={() => setDeleteTarget(c.id)}
                        className="p-1 text-text-secondary hover:text-red-400" title="Remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Simple delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-4">Remove this container?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
                Cancel
              </button>
              <button onClick={() => {
                handleAction(() => removeMut.mutateAsync({ id: deleteTarget, force: true }), 'Removed')
                setDeleteTarget(null)
              }} className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ContainersPage.tsx
git commit -m "feat: upgrade ContainersPage with full management actions"
```

---

### Task 17: ImagesPage — Pull + Remove

**Files:**
- Modify: `web/src/pages/ImagesPage.tsx`

- [ ] **Step 1: Rewrite ImagesPage**

Replace with TanStack Query-based page with Pull dialog and Remove action. Pattern is the same as ContainersPage — use hooks, add action buttons, add a Pull dialog with image:tag input, add remove confirmation.

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ImagesPage.tsx
git commit -m "feat: upgrade ImagesPage with pull and remove actions"
```

---

### Task 18: VolumesPage + NetworksPage — CRUD

**Files:**
- Modify: `web/src/pages/VolumesPage.tsx`
- Modify: `web/src/pages/NetworksPage.tsx`

- [ ] **Step 1: Rewrite VolumesPage**

Add Create dialog (name input), Remove action with confirmation. Use `useVolumes()`, `useCreateVolume()`, `useRemoveVolume()`.

- [ ] **Step 2: Rewrite NetworksPage**

Add Create dialog (name, driver, subnet inputs), Remove action. Use `useNetworks()`, `useCreateNetwork()`, `useRemoveNetwork()`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/VolumesPage.tsx web/src/pages/NetworksPage.tsx
git commit -m "feat: upgrade VolumesPage and NetworksPage with CRUD actions"
```

---

### Task 19: TerminalPage — xterm.js

**Files:**
- Create: `web/src/pages/TerminalPage.tsx`
- Modify: `web/src/router/index.tsx`

- [ ] **Step 1: Create TerminalPage**

Create `web/src/pages/TerminalPage.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPage() {
  const { id, exec_id } = useParams<{ id: string; exec_id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current || !exec_id) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#22c55e',
        selectionBackground: '#22c55e33',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminalRef.current = terminal

    // Connect WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/v1/containers/${id}/exec/${exec_id}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial resize
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
    }

    ws.onmessage = (e) => {
      if (e.data instanceof Blob) {
        e.data.arrayBuffer().then(buf => terminal.write(new Uint8Array(buf)))
      } else {
        terminal.write(e.data)
      }
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      ws.close()
      terminal.dispose()
    }
  }, [id, exec_id])

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
        <span className="text-xs text-text-secondary font-mono">
          Terminal — {id?.slice(0, 12)}
        </span>
        <button
          onClick={() => wsRef.current?.close()}
          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
        >
          Disconnect
        </button>
      </div>
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  )
}
```

- [ ] **Step 2: Add terminal route to router**

Add to `web/src/router/index.tsx` in the children array:

```tsx
{ path: 'containers/:id/exec/:exec_id', element: <TerminalPage /> },
```

- [ ] **Step 3: Verify build**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TerminalPage.tsx web/src/router/index.tsx
git commit -m "feat: add TerminalPage with xterm.js and WebSocket exec"
```

---

### Task 20: BackupPage

**Files:**
- Create: `web/src/pages/BackupPage.tsx`
- Modify: `web/src/router/index.tsx`

- [ ] **Step 1: Create BackupPage**

Create `web/src/pages/BackupPage.tsx` with:
- Export button → downloads tar.gz
- Import area → file picker → upload → confirm

- [ ] **Step 2: Add backup route to router**

Add `{ path: 'backup', element: <BackupPage /> }` to the router children.

- [ ] **Step 3: Add sidebar link**

Add "Backup" entry to the sidebar navigation in `AppSidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/BackupPage.tsx web/src/router/index.tsx
git commit -m "feat: add BackupPage with export/import"
```

---

## Phase 6: Global Polish

### Task 21: Toast Notifications + Confirm Dialogs

**Files:**
- Modify: `web/src/main.tsx` (add Toaster)
- Modify: `web/src/pages/FilesPage.tsx` (replace alert())

- [ ] **Step 1: Add Toaster to main.tsx**

Add `<Toaster />` from sonner inside the QueryProvider in `main.tsx`.

- [ ] **Step 2: Replace all alert() calls in FilesPage with toast.success/toast.error**

- [ ] **Step 3: Commit**

```bash
git add web/src/main.tsx web/src/pages/FilesPage.tsx
git commit -m "feat: replace alert() with sonner toast notifications"
```

---

### Task 22: Error Boundary + Lazy Loading

**Files:**
- Create: `web/src/components/ErrorBoundary.tsx`
- Modify: `web/src/router/index.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

Create `web/src/components/ErrorBoundary.tsx` with a React error boundary that shows a user-friendly error page.

- [ ] **Step 2: Add lazy loading to router**

Wrap all page imports with `React.lazy()` and add `<Suspense>` fallback.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ErrorBoundary.tsx web/src/router/index.tsx
git commit -m "feat: add ErrorBoundary and lazy-loaded routes"
```

---

### Task 23: WebSocket Alert System

**Files:**
- Modify: `internal/ws/hub.go`
- Modify: `cmd/quadlet-manager/main.go`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add unit_failed broadcast to hub**

Add an `AlertBroadcaster` method to `hub.go` that polls unit statuses every 5s and broadcasts `unit_failed` events when a unit transitions to failed state.

- [ ] **Step 2: Start alert broadcaster in main.go**

Wire the alert broadcaster alongside the existing stats broadcaster.

- [ ] **Step 3: Handle unit_failed in App.tsx**

In the `useWebSocket` hook handler, add a case for `unit_failed` that shows a toast notification.

- [ ] **Step 4: Commit**

```bash
git add internal/ws/hub.go cmd/quadlet-manager/main.go web/src/App.tsx
git commit -m "feat: add unit_failed alert system via WebSocket"
```

---

### Task 24: Final Integration Test

- [ ] **Step 1: Run all Go tests**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 2: Build frontend**

Run: `cd web && pnpm build`
Expected: PASS

- [ ] **Step 3: Build full binary**

Run: `go build -o bin/quadlet-manager ./cmd/quadlet-manager`
Expected: PASS

- [ ] **Step 4: Manual smoke test on Linux**

Run the binary and verify:
- Container list shows with actions
- Start/stop/restart works
- Image pull shows progress
- Volume/network create/delete works
- Web terminal opens and connects
- Backup export/import works
- Failed unit alert shows toast

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete manager redesign — full CRUD, exec terminal, backup, alerts"
```
