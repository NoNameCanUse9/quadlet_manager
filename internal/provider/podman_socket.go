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

// SocketPodmanProvider implements PodmanProvider via the libpod Unix socket API.
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
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 5,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	// Detect API version
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/info")
	if err != nil {
		return fmt.Errorf("podman socket connect: %w", err)
	}
	defer resp.Body.Close()

	var info struct {
		Version struct {
			APIVersion string `json:"APIVersion"`
		} `json:"version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		p.apiVersion = "v5.0.0"
		return nil
	}
	p.apiVersion = info.Version.APIVersion
	if p.apiVersion == "" {
		p.apiVersion = "v5.0.0"
	}
	if !strings.HasPrefix(p.apiVersion, "v") {
		p.apiVersion = "v" + p.apiVersion
	}
	return nil
}

func (p *SocketPodmanProvider) Close() {
	if p.client != nil {
		p.client.CloseIdleConnections()
	}
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
		return nil, nil
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
	data, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10MB cap
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, nil
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

	conn, err := net.Dial("unix", p.socketPath)
	if err != nil {
		return nil, fmt.Errorf("dial podman socket: %w", err)
	}

	if err := req.Write(conn); err != nil {
		conn.Close()
		return nil, fmt.Errorf("write exec request: %w", err)
	}

	// Read HTTP response headers, then return the raw connection for TTY I/O
	buf := make([]byte, 4096)
	total := 0
	for {
		n, err := conn.Read(buf[total:])
		if err != nil {
			conn.Close()
			return nil, fmt.Errorf("read exec response: %w", err)
		}
		total += n
		if strings.Contains(string(buf[:total]), "\r\n\r\n") {
			break
		}
	}

	return conn, nil
}

func (p *SocketPodmanProvider) ExecResize(_ context.Context, execID string, height, width uint) error {
	resp, err := p.do("POST", fmt.Sprintf("/exec/%s/resize?h=%d&w=%d", execID, height, width), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (p *SocketPodmanProvider) ListImages(_ context.Context) ([]model.ImageInfo, error) {
	// Podman API returns different field names than our model
	var raw []struct {
		ID       string   `json:"Id"`
		RepoTags []string `json:"RepoTags"`
		Size     int64    `json:"Size"`
	}
	err := p.doJSON("GET", "/images/json", nil, &raw)
	if err != nil {
		return nil, err
	}
	images := make([]model.ImageInfo, 0, len(raw))
	for _, r := range raw {
		tags := r.RepoTags
		if tags == nil {
			tags = []string{}
		}
		images = append(images, model.ImageInfo{
			ID:   r.ID,
			Tags: tags,
			Size: r.Size,
		})
	}
	return images, nil
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
	var volumes []model.VolumeInfo
	err := p.doJSON("GET", "/volumes/json", nil, &volumes)
	return volumes, err
}

func (p *SocketPodmanProvider) CreateVolume(_ context.Context, name string, labels map[string]string, opts map[string]string) (*model.VolumeInfo, error) {
	body := map[string]any{"Name": name}
	if len(labels) > 0 {
		body["Labels"] = labels
	}
	if len(opts) > 0 {
		body["Driver"] = "local"
		body["Options"] = opts
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
