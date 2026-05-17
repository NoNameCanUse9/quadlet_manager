package provider

import (
	"context"
	"fmt"
	"io"
	"net"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
)

// MockPodman is a test double for PodmanProvider.
type MockPodman struct {
	Containers []model.ContainerInfo
	Stats      []model.ContainerStats
	Images     []model.ImageInfo
	Volumes    []model.VolumeInfo
	Networks   []model.NetworkInfo
	Logs       []string
	Err        error
}

func NewMockPodman() *MockPodman {
	return &MockPodman{}
}

func (m *MockPodman) Connect(_ context.Context) error { return m.Err }
func (m *MockPodman) Close()                           {}

func (m *MockPodman) ListContainers(_ context.Context) ([]model.ContainerInfo, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Containers, nil
}

func (m *MockPodman) GetContainerStats(_ context.Context, id string) (*model.ContainerStats, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	for _, s := range m.Stats {
		if s.ID == id {
			return &s, nil
		}
	}
	return nil, nil
}

func (m *MockPodman) GetAllStats(_ context.Context) ([]model.ContainerStats, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Stats, nil
}

func (m *MockPodman) GetContainerLogs(_ context.Context, _ string, _ int) ([]string, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Logs, nil
}

func (m *MockPodman) ListImages(_ context.Context) ([]model.ImageInfo, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Images, nil
}

func (m *MockPodman) ListVolumes(_ context.Context) ([]model.VolumeInfo, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Volumes, nil
}

func (m *MockPodman) ListNetworks(_ context.Context) ([]model.NetworkInfo, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Networks, nil
}

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
			name := ""
			if len(c.Names) > 0 {
				name = c.Names[0]
			}
			return &model.ContainerInspect{
				ID:     c.ID,
				Name:   name,
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
