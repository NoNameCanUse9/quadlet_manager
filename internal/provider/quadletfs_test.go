package provider

import "testing"

var _ QuadletFS = (*MockQuadletFS)(nil)

func TestQuadletFSInterface(t *testing.T) {
	t.Log("QuadletFS interface defined")
}
