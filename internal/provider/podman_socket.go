package provider

import (
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
	// Verify connection with a simple request
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/info")
	if err != nil {
		return fmt.Errorf("podman socket connect: %w", err)
	}
	resp.Body.Close()
	return nil
}

func (p *SocketPodmanProvider) Close() {
	if p.client != nil {
		p.client.CloseIdleConnections()
	}
}

func (p *SocketPodmanProvider) ListContainers(_ context.Context) ([]model.ContainerInfo, error) {
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/containers/json?all=true")
	if err != nil {
		return nil, fmt.Errorf("list containers: %w", err)
	}
	defer resp.Body.Close()

	var containers []model.ContainerInfo
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, fmt.Errorf("decode containers: %w", err)
	}
	return containers, nil
}

func (p *SocketPodmanProvider) GetContainerStats(_ context.Context, id string) (*model.ContainerStats, error) {
	resp, err := p.client.Get(fmt.Sprintf("http://localhost/v5.0.0/libpod/containers/%s/stats?stream=false", id))
	if err != nil {
		return nil, fmt.Errorf("get stats for %s: %w", id, err)
	}
	defer resp.Body.Close()

	var stats []model.ContainerStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, fmt.Errorf("decode stats: %w", err)
	}
	if len(stats) == 0 {
		return nil, nil
	}
	return &stats[0], nil
}

func (p *SocketPodmanProvider) GetAllStats(_ context.Context) ([]model.ContainerStats, error) {
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/containers/stats?stream=false")
	if err != nil {
		return nil, fmt.Errorf("get all stats: %w", err)
	}
	defer resp.Body.Close()

	var stats []model.ContainerStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, fmt.Errorf("decode stats: %w", err)
	}
	return stats, nil
}

func (p *SocketPodmanProvider) GetContainerLogs(_ context.Context, id string, tail int) ([]string, error) {
	url := fmt.Sprintf("http://localhost/v5.0.0/libpod/containers/%s/logs?tail=%d&follow=false", id, tail)
	resp, err := p.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("get logs for %s: %w", id, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read logs: %w", err)
	}
	if len(body) == 0 {
		return nil, nil
	}
	return strings.Split(string(body), "\n"), nil
}

func (p *SocketPodmanProvider) ListImages(_ context.Context) ([]model.ImageInfo, error) {
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/images/json")
	if err != nil {
		return nil, fmt.Errorf("list images: %w", err)
	}
	defer resp.Body.Close()

	var images []model.ImageInfo
	if err := json.NewDecoder(resp.Body).Decode(&images); err != nil {
		return nil, fmt.Errorf("decode images: %w", err)
	}
	return images, nil
}

func (p *SocketPodmanProvider) ListVolumes(_ context.Context) ([]model.VolumeInfo, error) {
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/volumes/json")
	if err != nil {
		return nil, fmt.Errorf("list volumes: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Volumes []model.VolumeInfo `json:"Volumes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode volumes: %w", err)
	}
	return result.Volumes, nil
}

func (p *SocketPodmanProvider) ListNetworks(_ context.Context) ([]model.NetworkInfo, error) {
	resp, err := p.client.Get("http://localhost/v5.0.0/libpod/networks/json")
	if err != nil {
		return nil, fmt.Errorf("list networks: %w", err)
	}
	defer resp.Body.Close()

	var networks []model.NetworkInfo
	if err := json.NewDecoder(resp.Body).Decode(&networks); err != nil {
		return nil, fmt.Errorf("decode networks: %w", err)
	}
	return networks, nil
}

// Ensure SocketPodmanProvider satisfies the interface at compile time.
var _ PodmanProvider = (*SocketPodmanProvider)(nil)
