package provider

import (
	"context"
	"fmt"

	"github.com/choken/quadlet-manager/internal/model"
)

// MockSystemd is a test double for SystemdProvider.
type MockSystemd struct {
	Rootless bool
	Units    map[string]model.UnitStatus
	Enabled  map[string]bool
	Err      error // injected error for all methods
	Events   chan model.UnitChangeEvent
}

func NewMockSystemd(rootless bool) *MockSystemd {
	return &MockSystemd{
		Rootless: rootless,
		Units:    make(map[string]model.UnitStatus),
		Enabled:  make(map[string]bool),
		Events:   make(chan model.UnitChangeEvent, 10),
	}
}

func (m *MockSystemd) Connect(_ context.Context) error { return m.Err }
func (m *MockSystemd) Close()                           {}
func (m *MockSystemd) IsRootless() bool                 { return m.Rootless }

func (m *MockSystemd) DaemonReload(_ context.Context) error { return m.Err }
func (m *MockSystemd) StartUnit(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	if u, ok := m.Units[name]; ok {
		u.ActiveState = "active"
		u.SubState = "running"
		m.Units[name] = u
	}
	return nil
}
func (m *MockSystemd) StopUnit(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	if u, ok := m.Units[name]; ok {
		u.ActiveState = "inactive"
		u.SubState = "dead"
		m.Units[name] = u
	}
	return nil
}
func (m *MockSystemd) RestartUnit(_ context.Context, name string) error {
	if m.Err != nil {
		return m.Err
	}
	if u, ok := m.Units[name]; ok {
		u.ActiveState = "active"
		u.SubState = "running"
		m.Units[name] = u
	}
	return nil
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
func (m *MockSystemd) IsUnitEnabled(_ context.Context, name string) (bool, error) {
	if m.Err != nil {
		return false, m.Err
	}
	return m.Enabled[name], nil
}

func (m *MockSystemd) ListUnits(_ context.Context) ([]model.UnitStatus, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	units := make([]model.UnitStatus, 0, len(m.Units))
	for _, u := range m.Units {
		units = append(units, u)
	}
	return units, nil
}

func (m *MockSystemd) GetUnitStatus(_ context.Context, name string) (*model.UnitStatus, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	u, ok := m.Units[name]
	if !ok {
		return nil, fmt.Errorf("unit %s not found", name)
	}
	return &u, nil
}

func (m *MockSystemd) SubscribeUnitChanges(_ context.Context) (<-chan model.UnitChangeEvent, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return m.Events, nil
}
