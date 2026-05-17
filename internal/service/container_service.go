package service

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type ContainerService struct {
	podman provider.PodmanProvider
}

func NewContainerService(podman provider.PodmanProvider) *ContainerService {
	return &ContainerService{podman: podman}
}

func (s *ContainerService) ListContainers(ctx context.Context) ([]model.ContainerInfo, error) {
	return s.podman.ListContainers(ctx)
}

func (s *ContainerService) GetContainerLogs(ctx context.Context, id string, tail int) ([]string, error) {
	return s.podman.GetContainerLogs(ctx, id, tail)
}

func (s *ContainerService) GetAllStats(ctx context.Context) ([]model.ContainerStats, error) {
	return s.podman.GetAllStats(ctx)
}

func (s *ContainerService) ListImages(ctx context.Context) ([]model.ImageInfo, error) {
	return s.podman.ListImages(ctx)
}

func (s *ContainerService) ListVolumes(ctx context.Context) ([]model.VolumeInfo, error) {
	return s.podman.ListVolumes(ctx)
}

func (s *ContainerService) ListNetworks(ctx context.Context) ([]model.NetworkInfo, error) {
	return s.podman.ListNetworks(ctx)
}

func (s *ContainerService) PauseContainer(ctx context.Context, id string) error {
	return s.podman.PauseContainer(ctx, id)
}

func (s *ContainerService) UnpauseContainer(ctx context.Context, id string) error {
	return s.podman.UnpauseContainer(ctx, id)
}

func (s *ContainerService) InspectContainer(ctx context.Context, id string) (*model.ContainerInspect, error) {
	return s.podman.InspectContainer(ctx, id)
}
