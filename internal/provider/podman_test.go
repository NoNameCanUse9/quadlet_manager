package provider

import "testing"

var _ PodmanProvider = (*MockPodman)(nil)

func TestPodmanInterface(t *testing.T) {
	t.Log("PodmanProvider interface defined")
}
