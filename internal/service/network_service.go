package service

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type NetworkService struct {
	podman provider.PodmanProvider
}

func NewNetworkService(podman provider.PodmanProvider) *NetworkService {
	return &NetworkService{podman: podman}
}

func (s *NetworkService) ListNetworks(ctx context.Context) ([]model.NetworkInfo, error) {
	return s.podman.ListNetworks(ctx)
}

func (s *NetworkService) CreateNetwork(ctx context.Context, name, driver, subnet string) error {
	return s.podman.CreateNetwork(ctx, name, driver, subnet)
}

func (s *NetworkService) RemoveNetwork(ctx context.Context, name string) error {
	return s.podman.RemoveNetwork(ctx, name)
}

func (s *NetworkService) InspectNetwork(ctx context.Context, name string) (map[string]any, error) {
	return s.podman.InspectNetwork(ctx, name)
}
