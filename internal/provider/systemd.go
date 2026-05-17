package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

// SystemdProvider abstracts systemd operations via D-Bus.
type SystemdProvider interface {
	Connect(ctx context.Context) error
	Close()
	IsRootless() bool

	DaemonReload(ctx context.Context) error
	StartUnit(ctx context.Context, name string) error
	StopUnit(ctx context.Context, name string) error
	RestartUnit(ctx context.Context, name string) error
	EnableUnit(ctx context.Context, name string) error
	DisableUnit(ctx context.Context, name string) error

	ListUnits(ctx context.Context) ([]model.UnitStatus, error)
	GetUnitStatus(ctx context.Context, name string) (*model.UnitStatus, error)

	SubscribeUnitChanges(ctx context.Context) (<-chan model.UnitChangeEvent, error)
}
