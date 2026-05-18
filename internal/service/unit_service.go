package service

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type UnitService struct {
	systemd    provider.SystemdProvider
	quadlet    provider.QuadletFS
	settings   SettingsLookup
	defaultDir string
}

func NewUnitService(systemd provider.SystemdProvider, quadlet provider.QuadletFS, settings SettingsLookup, defaultDir string) *UnitService {
	return &UnitService{systemd: systemd, quadlet: quadlet, settings: settings, defaultDir: defaultDir}
}

func (s *UnitService) resolveFS(ctx context.Context, userID int64) provider.QuadletFS {
	if s.settings != nil && userID > 0 {
		if st, err := s.settings.GetByUserID(userID); err == nil && st.QuadletDir != "" {
			return provider.NewQuadletFSImpl(st.QuadletDir)
		}
	}
	return s.quadlet
}

func (s *UnitService) ListUnits(ctx context.Context, userID int64) ([]model.UnitStatus, error) {
	fs := s.resolveFS(ctx, userID)
	files, err := fs.ScanDir(ctx)
	if err != nil {
		return nil, fmt.Errorf("scan quadlet directory: %w", err)
	}

	serviceMap := make(map[string]string)
	for _, f := range files {
		ext := filepath.Ext(f.Name)
		base := strings.TrimSuffix(f.Name, ext)
		var svcName string
		switch ext {
		case ".container":
			svcName = base + ".service"
		case ".volume":
			svcName = base + "-volume.service"
		case ".network":
			svcName = base + "-network.service"
		case ".pod":
			svcName = base + "-pod.service"
		case ".kube":
			svcName = base + "-kube.service"
		case ".image":
			svcName = base + "-image.service"
		default:
			continue
		}
		serviceMap[svcName] = f.Path
	}

	allUnits, err := s.systemd.ListUnits(ctx)
	if err != nil {
		return nil, fmt.Errorf("list systemd units: %w", err)
	}

	filtered := make([]model.UnitStatus, 0)
	for _, u := range allUnits {
		if path, ok := serviceMap[u.Name]; ok {
			u.SourcePath = path
			filtered = append(filtered, u)
		}
	}

	return filtered, nil
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
