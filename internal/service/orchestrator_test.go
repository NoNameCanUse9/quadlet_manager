package service

import (
	"context"
	"testing"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

func TestOrchestrator_IsManaged_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "orphan-1", Names: []string{"debug"}, Image: "alpine", State: "running"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	managed, _, err := orch.IsManaged(context.Background(), "orphan-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if managed {
		t.Error("expected orphan-1 to not be managed")
	}
}

func TestOrchestrator_Start_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "exited"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Start(context.Background(), "c1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if podman.Containers[0].State != "running" {
		t.Errorf("expected state running, got %s", podman.Containers[0].State)
	}
}

func TestOrchestrator_Stop_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "running"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Stop(context.Background(), "c1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if podman.Containers[0].State != "exited" {
		t.Errorf("expected state exited, got %s", podman.Containers[0].State)
	}
}

func TestOrchestrator_Restart_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "exited"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Restart(context.Background(), "c1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if podman.Containers[0].State != "running" {
		t.Errorf("expected state running, got %s", podman.Containers[0].State)
	}
}

func TestOrchestrator_Remove_Orphan(t *testing.T) {
	podman := &provider.MockPodman{
		Containers: []model.ContainerInfo{
			{ID: "c1", Names: []string{"test"}, Image: "alpine", State: "exited"},
		},
	}
	systemd := &provider.MockSystemd{Rootless: true}
	orch := NewContainerOrchestrator(systemd, podman)

	err := orch.Remove(context.Background(), "c1", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(podman.Containers) != 0 {
		t.Errorf("expected 0 containers, got %d", len(podman.Containers))
	}
}
