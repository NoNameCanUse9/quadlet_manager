package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

// PodmanProvider abstracts Podman operations via the libpod socket API.
type PodmanProvider interface {
	Connect(ctx context.Context) error
	Close()

	ListContainers(ctx context.Context) ([]model.ContainerInfo, error)
	GetContainerStats(ctx context.Context, id string) (*model.ContainerStats, error)
	GetAllStats(ctx context.Context) ([]model.ContainerStats, error)
	GetContainerLogs(ctx context.Context, id string, tail int) ([]string, error)

	ListImages(ctx context.Context) ([]model.ImageInfo, error)
	ListVolumes(ctx context.Context) ([]model.VolumeInfo, error)
	ListNetworks(ctx context.Context) ([]model.NetworkInfo, error)
}
