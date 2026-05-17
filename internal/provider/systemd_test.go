package provider

import "testing"

var _ SystemdProvider = (*MockSystemd)(nil)

func TestSystemdInterface(t *testing.T) {
	t.Log("SystemdProvider interface defined")
}
