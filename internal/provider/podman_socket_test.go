//go:build integration

package provider

import (
	"context"
	"fmt"
	"os"
	"testing"
)

func TestSocketPodmanConnect(t *testing.T) {
	socket := os.Getenv("PODMAN_SOCKET")
	if socket == "" {
		socket = fmt.Sprintf("/run/user/%d/podman/podman.sock", os.Getuid())
	}
	if _, err := os.Stat(socket); os.IsNotExist(err) {
		t.Skip("Podman socket not available, skipping integration test")
	}

	p := NewSocketPodmanProvider(socket)
	if err := p.Connect(context.Background()); err != nil {
		t.Fatalf("Connect() error: %v", err)
	}
	defer p.Close()
}

func TestSocketPodmanListContainers(t *testing.T) {
	socket := os.Getenv("PODMAN_SOCKET")
	if socket == "" {
		socket = fmt.Sprintf("/run/user/%d/podman/podman.sock", os.Getuid())
	}
	if _, err := os.Stat(socket); os.IsNotExist(err) {
		t.Skip("Podman socket not available")
	}

	p := NewSocketPodmanProvider(socket)
	if err := p.Connect(context.Background()); err != nil {
		t.Fatalf("Connect() error: %v", err)
	}
	defer p.Close()

	containers, err := p.ListContainers(context.Background())
	if err != nil {
		t.Fatalf("ListContainers() error: %v", err)
	}
	t.Logf("Found %d containers", len(containers))
}
