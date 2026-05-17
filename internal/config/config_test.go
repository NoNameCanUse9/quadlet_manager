package config

import (
	"os"
	"testing"
)

func TestNewDefaults(t *testing.T) {
	cfg := New(Options{})
	if cfg.Port != 8080 {
		t.Errorf("expected Port 8080, got %d", cfg.Port)
	}
	if cfg.Rootless != (os.Getuid() != 0) {
		t.Errorf("expected Rootless %v, got %v", os.Getuid() != 0, cfg.Rootless)
	}
	if cfg.QuadletDir == "" {
		t.Error("expected QuadletDir to be set")
	}
	if cfg.PodmanSocket == "" {
		t.Error("expected PodmanSocket to be set")
	}
}

func TestNewOverrides(t *testing.T) {
	cfg := New(Options{
		Port:         9090,
		Rootless:     boolPtr(false),
		QuadletDir:   "/custom/quadlet",
		PodmanSocket: "/custom/podman.sock",
		DevMode:      true,
	})
	if cfg.Port != 9090 {
		t.Errorf("expected Port 9090, got %d", cfg.Port)
	}
	if cfg.Rootless {
		t.Error("expected Rootless false")
	}
	if cfg.QuadletDir != "/custom/quadlet" {
		t.Errorf("expected /custom/quadlet, got %s", cfg.QuadletDir)
	}
	if cfg.PodmanSocket != "/custom/podman.sock" {
		t.Errorf("expected /custom/podman.sock, got %s", cfg.PodmanSocket)
	}
	if !cfg.DevMode {
		t.Error("expected DevMode true")
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{"valid", Config{Port: 8080, QuadletDir: "/tmp/q", PodmanSocket: "/tmp/s"}, false},
		{"invalid port low", Config{Port: 0, QuadletDir: "/tmp/q", PodmanSocket: "/tmp/s"}, true},
		{"invalid port high", Config{Port: 70000, QuadletDir: "/tmp/q", PodmanSocket: "/tmp/s"}, true},
		{"missing quadlet dir", Config{Port: 8080, PodmanSocket: "/tmp/s"}, true},
		{"missing socket", Config{Port: 8080, QuadletDir: "/tmp/q"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func boolPtr(b bool) *bool {
	return &b
}
