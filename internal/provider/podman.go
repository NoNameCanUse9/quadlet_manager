package provider

import (
	"context"
	"io"
	"net"

	"github.com/choken/quadlet-manager/internal/model"
)

// PodmanProvider abstracts all Podman API operations.
type PodmanProvider interface {
	Connect(ctx context.Context) error
	Close()
	APIVersion() string

	// Container lifecycle
	ListContainers(ctx context.Context) ([]model.ContainerInfo, error)
	GetContainerStats(ctx context.Context, id string) (*model.ContainerStats, error)
	GetAllStats(ctx context.Context) ([]model.ContainerStats, error)
	GetContainerLogs(ctx context.Context, id string, tail int) ([]string, error)
	StartContainer(ctx context.Context, id string) error
	StopContainer(ctx context.Context, id string, timeout *int) error
	RestartContainer(ctx context.Context, id string, timeout *int) error
	PauseContainer(ctx context.Context, id string) error
	UnpauseContainer(ctx context.Context, id string) error
	RemoveContainer(ctx context.Context, id string, force bool) error
	InspectContainer(ctx context.Context, id string) (*model.ContainerInspect, error)

	// Container exec
	ExecCreate(ctx context.Context, containerID string, cmd []string, tty bool) (string, error)
	ExecAttach(ctx context.Context, execID string) (net.Conn, error)
	ExecResize(ctx context.Context, execID string, height, width uint) error

	// Images
	ListImages(ctx context.Context) ([]model.ImageInfo, error)
	PullImage(ctx context.Context, name string) (io.ReadCloser, error)
	RemoveImage(ctx context.Context, id string, force bool) error
	InspectImage(ctx context.Context, id string) (map[string]any, error)

	// Volumes
	ListVolumes(ctx context.Context) ([]model.VolumeInfo, error)
	CreateVolume(ctx context.Context, name string, labels map[string]string, opts map[string]string) (*model.VolumeInfo, error)
	RemoveVolume(ctx context.Context, name string, force bool) error
	InspectVolume(ctx context.Context, name string) (map[string]any, error)
	ExportVolume(ctx context.Context, name string) (io.ReadCloser, error)
	ImportVolume(ctx context.Context, name string, reader io.Reader) error
	PruneVolumes(ctx context.Context) (int, error)

	// Networks
	ListNetworks(ctx context.Context) ([]model.NetworkInfo, error)
	CreateNetwork(ctx context.Context, name, driver string, subnet string) error
	RemoveNetwork(ctx context.Context, name string) error
	InspectNetwork(ctx context.Context, name string) (map[string]any, error)
	ConnectNetwork(ctx context.Context, name, containerID string) error
	DisconnectNetwork(ctx context.Context, name, containerID string, force bool) error
	PruneNetworks(ctx context.Context) (int, error)
}
