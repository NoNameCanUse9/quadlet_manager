package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

// MockCompose is a test double for ComposeProvider.
type MockCompose struct {
	Projects    []model.ComposeProject
	Services    []model.ComposeService
	LogLines    []string
	Conversions []model.QuadletConversion
	Err         error
}

func NewMockCompose() *MockCompose {
	return &MockCompose{}
}

func (m *MockCompose) ImportProject(_ context.Context, name string, _ string, _ string) error {
	if m.Err != nil {
		return m.Err
	}
	m.Projects = append(m.Projects, model.ComposeProject{
		Name:   name,
		Status: "stopped",
	})
	return nil
}

func (m *MockCompose) ListProjects(_ context.Context) ([]model.ComposeProject, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	if m.Projects == nil {
		return []model.ComposeProject{}, nil
	}
	return m.Projects, nil
}

func (m *MockCompose) RemoveProject(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	for i, p := range m.Projects {
		if p.Name == name {
			m.Projects = append(m.Projects[:i], m.Projects[i+1:]...)
			return nil
		}
	}
	return nil
}

func (m *MockCompose) Up(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	for i, p := range m.Projects {
		if p.Name == name {
			m.Projects[i].Status = "running"
		}
	}
	return nil
}

func (m *MockCompose) Down(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	for i, p := range m.Projects {
		if p.Name == name {
			m.Projects[i].Status = "stopped"
		}
	}
	return nil
}

func (m *MockCompose) Ps(_ context.Context, _ string) ([]model.ComposeService, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	if m.Services == nil {
		return []model.ComposeService{}, nil
	}
	return m.Services, nil
}

func (m *MockCompose) Logs(_ context.Context, _ string, _ string, _ int) ([]string, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	if m.LogLines == nil {
		return []string{}, nil
	}
	return m.LogLines, nil
}

func (m *MockCompose) ConvertToQuadlet(_ context.Context, _ string) ([]model.QuadletConversion, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Conversions, nil
}
