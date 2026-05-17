package provider

import (
	"context"
	"fmt"

	"github.com/choken/quadlet-manager/internal/model"
)

// DBusSystemdProvider implements SystemdProvider via the system/session D-Bus.
// This is the real implementation used in production (requires Linux + systemd).
type DBusSystemdProvider struct {
	rootless bool
	// conn will be a *dbus.Conn from godbus/dbus/v5
	// For now this is a stub; full D-Bus integration requires the godbus dependency.
}

func NewDBusSystemdProvider(rootless bool) *DBusSystemdProvider {
	return &DBusSystemdProvider{rootless: rootless}
}

func (p *DBusSystemdProvider) Connect(ctx context.Context) error {
	return fmt.Errorf("dbus provider not yet implemented: requires godbus/dbus/v5")
}

func (p *DBusSystemdProvider) Close() {}

func (p *DBusSystemdProvider) IsRootless() bool {
	return p.rootless
}

func (p *DBusSystemdProvider) DaemonReload(ctx context.Context) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) StartUnit(ctx context.Context, name string) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) StopUnit(ctx context.Context, name string) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) RestartUnit(ctx context.Context, name string) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) EnableUnit(ctx context.Context, name string) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) DisableUnit(ctx context.Context, name string) error {
	return fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) ListUnits(ctx context.Context) ([]model.UnitStatus, error) {
	return nil, fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) GetUnitStatus(ctx context.Context, name string) (*model.UnitStatus, error) {
	return nil, fmt.Errorf("not implemented")
}

func (p *DBusSystemdProvider) SubscribeUnitChanges(ctx context.Context) (<-chan model.UnitChangeEvent, error) {
	return nil, fmt.Errorf("not implemented")
}
