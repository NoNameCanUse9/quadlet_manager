package service

import (
	"context"
	"fmt"

	"github.com/choken/quadlet-manager/internal/provider"
)

// ContainerOrchestrator routes container operations through the correct
// provider: systemd D-Bus for Quadlet-managed containers, Libpod API for orphans.
type ContainerOrchestrator struct {
	systemd provider.SystemdProvider
	podman  provider.PodmanProvider
}

func NewContainerOrchestrator(systemd provider.SystemdProvider, podman provider.PodmanProvider) *ContainerOrchestrator {
	return &ContainerOrchestrator{systemd: systemd, podman: podman}
}

// IsManaged checks if a container is Quadlet-managed by inspecting its labels.
// Returns (isManaged, unitName, error).
func (o *ContainerOrchestrator) IsManaged(ctx context.Context, containerID string) (bool, string, error) {
	info, err := o.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return false, "", fmt.Errorf("inspect container %s: %w", containerID, err)
	}

	if info.Labels != nil {
		if unit, ok := info.Labels["io.containers.systemd.unit"]; ok && unit != "" {
			return true, unit, nil
		}
	}
	return false, "", nil
}

// Start starts a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Start(ctx context.Context, containerID string) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.StartUnit(ctx, unitName)
	}
	return o.podman.StartContainer(ctx, containerID)
}

// Stop stops a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Stop(ctx context.Context, containerID string, timeout *int) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.StopUnit(ctx, unitName)
	}
	return o.podman.StopContainer(ctx, containerID, timeout)
}

// Restart restarts a container, routing through systemd if Quadlet-managed.
func (o *ContainerOrchestrator) Restart(ctx context.Context, containerID string, timeout *int) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		return o.systemd.RestartUnit(ctx, unitName)
	}
	return o.podman.RestartContainer(ctx, containerID, timeout)
}

// Remove removes a container. Quadlet-managed containers are stopped via systemd first.
func (o *ContainerOrchestrator) Remove(ctx context.Context, containerID string, force bool) error {
	managed, unitName, err := o.IsManaged(ctx, containerID)
	if err != nil {
		return err
	}
	if managed {
		if err := o.systemd.StopUnit(ctx, unitName); err != nil && !force {
			return err
		}
	}
	return o.podman.RemoveContainer(ctx, containerID, force)
}
