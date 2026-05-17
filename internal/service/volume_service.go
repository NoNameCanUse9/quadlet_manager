package service

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type VolumeService struct {
	podman provider.PodmanProvider
}

func NewVolumeService(podman provider.PodmanProvider) *VolumeService {
	return &VolumeService{podman: podman}
}

func (s *VolumeService) ListVolumes(ctx context.Context) ([]model.VolumeInfo, error) {
	return s.podman.ListVolumes(ctx)
}

func (s *VolumeService) CreateVolume(ctx context.Context, name string, labels map[string]string) (*model.VolumeInfo, error) {
	return s.podman.CreateVolume(ctx, name, labels)
}

func (s *VolumeService) RemoveVolume(ctx context.Context, name string, force bool) error {
	return s.podman.RemoveVolume(ctx, name, force)
}

func (s *VolumeService) InspectVolume(ctx context.Context, name string) (map[string]any, error) {
	return s.podman.InspectVolume(ctx, name)
}
