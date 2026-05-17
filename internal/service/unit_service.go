package service

import (
	"context"
	"fmt"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type UnitService struct {
	systemd provider.SystemdProvider
	quadlet provider.QuadletFS
}

func NewUnitService(systemd provider.SystemdProvider, quadlet provider.QuadletFS) *UnitService {
	return &UnitService{systemd: systemd, quadlet: quadlet}
}

func (s *UnitService) ListUnits(ctx context.Context) ([]model.UnitStatus, error) {
	return s.systemd.ListUnits(ctx)
}

func (s *UnitService) GetUnitStatus(ctx context.Context, name string) (*model.UnitStatus, error) {
	return s.systemd.GetUnitStatus(ctx, name)
}

func (s *UnitService) StartUnit(ctx context.Context, name string) error {
	if err := s.systemd.DaemonReload(ctx); err != nil {
		return fmt.Errorf("daemon reload: %w", err)
	}
	return s.systemd.StartUnit(ctx, name)
}

func (s *UnitService) StopUnit(ctx context.Context, name string) error {
	return s.systemd.StopUnit(ctx, name)
}

func (s *UnitService) RestartUnit(ctx context.Context, name string) error {
	return s.systemd.RestartUnit(ctx, name)
}

func (s *UnitService) EnableUnit(ctx context.Context, name string) error {
	return s.systemd.EnableUnit(ctx, name)
}

func (s *UnitService) DisableUnit(ctx context.Context, name string) error {
	return s.systemd.DisableUnit(ctx, name)
}

func (s *UnitService) DaemonReload(ctx context.Context) error {
	return s.systemd.DaemonReload(ctx)
}

func (s *UnitService) SubscribeUnitChanges(ctx context.Context) (<-chan model.UnitChangeEvent, error) {
	return s.systemd.SubscribeUnitChanges(ctx)
}
