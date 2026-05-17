package parser

import (
	"strings"
	"testing"
)

const sampleContainer = `[Unit]
Description=My Nginx Container
After=network-online.target

[Container]
Image=docker.io/library/nginx:latest
PublishPort=8080:80
Volume=/host/path:/container/path
Environment=MY_VAR=hello
Label=app=web

[Service]
Restart=always

[Install]
WantedBy=default.target
`

func TestParseContainerFile(t *testing.T) {
	cfg, err := ParseQuadletFile(sampleContainer)
	if err != nil {
		t.Fatalf("ParseQuadletFile() error: %v", err)
	}
	if cfg.Unit["Description"] != "My Nginx Container" {
		t.Errorf("expected Description 'My Nginx Container', got '%s'", cfg.Unit["Description"])
	}
	if cfg.Container.Image != "docker.io/library/nginx:latest" {
		t.Errorf("expected Image 'docker.io/library/nginx:latest', got '%s'", cfg.Container.Image)
	}
	if len(cfg.Container.PublishPort) != 1 || cfg.Container.PublishPort[0] != "8080:80" {
		t.Errorf("expected PublishPort ['8080:80'], got %v", cfg.Container.PublishPort)
	}
	if len(cfg.Container.Volume) != 1 || cfg.Container.Volume[0] != "/host/path:/container/path" {
		t.Errorf("expected Volume ['/host/path:/container/path'], got %v", cfg.Container.Volume)
	}
	if len(cfg.Container.Environment) != 1 || cfg.Container.Environment[0] != "MY_VAR=hello" {
		t.Errorf("expected Environment ['MY_VAR=hello'], got %v", cfg.Container.Environment)
	}
	if len(cfg.Container.Label) != 1 || cfg.Container.Label[0] != "app=web" {
		t.Errorf("expected Label ['app=web'], got %v", cfg.Container.Label)
	}
	if cfg.Service["Restart"] != "always" {
		t.Errorf("expected Restart 'always', got '%s'", cfg.Service["Restart"])
	}
	if cfg.Install["WantedBy"] != "default.target" {
		t.Errorf("expected WantedBy 'default.target', got '%s'", cfg.Install["WantedBy"])
	}
}

func TestRoundTrip(t *testing.T) {
	cfg, err := ParseQuadletFile(sampleContainer)
	if err != nil {
		t.Fatalf("ParseQuadletFile() error: %v", err)
	}
	generated := GenerateQuadletFile(cfg)
	cfg2, err := ParseQuadletFile(generated)
	if err != nil {
		t.Fatalf("re-parse error: %v", err)
	}
	if cfg2.Container.Image != cfg.Container.Image {
		t.Errorf("round-trip Image mismatch: %s vs %s", cfg2.Container.Image, cfg.Container.Image)
	}
	if len(cfg2.Container.PublishPort) != len(cfg.Container.PublishPort) {
		t.Errorf("round-trip PublishPort count mismatch: %d vs %d", len(cfg2.Container.PublishPort), len(cfg.Container.PublishPort))
	}
	if cfg2.Service["Restart"] != cfg.Service["Restart"] {
		t.Errorf("round-trip Restart mismatch: %s vs %s", cfg2.Service["Restart"], cfg.Service["Restart"])
	}
}

func TestMultiValueKeys(t *testing.T) {
	input := `[Container]
Image=test:latest
PublishPort=8080:80
PublishPort=8443:443
Volume=/a:/b
Volume=/c:/d
Environment=A=1
Environment=B=2
`
	cfg, err := ParseQuadletFile(input)
	if err != nil {
		t.Fatalf("ParseQuadletFile() error: %v", err)
	}
	if len(cfg.Container.PublishPort) != 2 {
		t.Errorf("expected 2 PublishPort, got %d", len(cfg.Container.PublishPort))
	}
	if len(cfg.Container.Volume) != 2 {
		t.Errorf("expected 2 Volume, got %d", len(cfg.Container.Volume))
	}
	if len(cfg.Container.Environment) != 2 {
		t.Errorf("expected 2 Environment, got %d", len(cfg.Container.Environment))
	}
}

func TestEmptyFile(t *testing.T) {
	cfg, err := ParseQuadletFile("")
	if err != nil {
		t.Fatalf("ParseQuadletFile('') error: %v", err)
	}
	if cfg.Container.Image != "" {
		t.Errorf("expected empty Image, got '%s'", cfg.Container.Image)
	}
}

func TestVolumeFile(t *testing.T) {
	input := `[Volume]
Label=app=data

[Install]
WantedBy=default.target
`
	cfg, err := ParseQuadletFile(input)
	if err != nil {
		t.Fatalf("ParseQuadletFile() error: %v", err)
	}
	// Volume section goes to Raw since we don't have a VolumeSection struct
	if cfg.Raw["Volume"] == nil {
		t.Error("expected Volume raw section")
	}
	if cfg.Raw["Volume"]["Label"] != "app=data" {
		t.Errorf("expected Label 'app=data', got '%s'", cfg.Raw["Volume"]["Label"])
	}
}

func TestGeneratorProducesValidINI(t *testing.T) {
	cfg := &QuadletConfig{
		Unit: map[string]string{"Description": "Test"},
		Container: ContainerSection{
			Image:       "test:latest",
			PublishPort: []string{"8080:80", "8443:443"},
			Volume:      []string{"/a:/b"},
			Environment: []string{"X=1"},
		},
		Service: map[string]string{"Restart": "always"},
		Install: map[string]string{"WantedBy": "default.target"},
	}
	output := GenerateQuadletFile(cfg)
	if !strings.Contains(output, "[Unit]") {
		t.Error("missing [Unit] section")
	}
	if !strings.Contains(output, "[Container]") {
		t.Error("missing [Container] section")
	}
	if !strings.Contains(output, "Image=test:latest") {
		t.Error("missing Image directive")
	}
	if !strings.Contains(output, "PublishPort=8080:80") {
		t.Error("missing first PublishPort")
	}
	if !strings.Contains(output, "PublishPort=8443:443") {
		t.Error("missing second PublishPort")
	}
}
