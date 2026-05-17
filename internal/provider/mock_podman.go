package provider

import (
	"context"

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
