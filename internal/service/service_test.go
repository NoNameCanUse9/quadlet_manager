package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

// --- filenameToUnitName tests ---

func TestFilenameToUnitName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"nginx.container", "nginx.service"},
		{"postgres.container", "postgres.service"},
		{"data.volume", "data.volume"},
		{"mynet.network", "mynet.network"},
		{"mypod.pod", "mypod.pod"},
		{"app.kube", "app.service"},
		{"base.image", "base.image"},
		{"noext", ""},
		{"", ""},
		{"file.txt", ""},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := filenameToUnitName(tt.input)
			if got != tt.want {
				t.Errorf("filenameToUnitName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// --- UnitService tests ---

func TestUnitService_StartUnit_ReloadsFirst(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	sd.Units["nginx.service"] = model.UnitStatus{
		Name: "nginx.service", ActiveState: "inactive", SubState: "dead",
	}
	fs := provider.NewMockQuadletFS()
	svc := NewUnitService(sd, fs, nil, "")

	err := svc.StartUnit(context.Background(), "nginx.service")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	u := sd.Units["nginx.service"]
	if u.ActiveState != "active" {
		t.Errorf("expected active, got %s", u.ActiveState)
	}
}

func TestUnitService_StartUnit_ReloadFails(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	sd.Err = fmt.Errorf("dbus connection lost")
	fs := provider.NewMockQuadletFS()
	svc := NewUnitService(sd, fs, nil, "")

	err := svc.StartUnit(context.Background(), "nginx.service")
	if err == nil {
		t.Fatal("expected error from daemon reload")
	}
}

func TestUnitService_ListUnits(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	sd.Units["a.service"] = model.UnitStatus{Name: "a.service", ActiveState: "active"}
	sd.Units["b.service"] = model.UnitStatus{Name: "b.service", ActiveState: "inactive"}
	fs := provider.NewMockQuadletFS()
	fs.Files["a.container"] = "[Container]\nImage=alpine\n"
	fs.Files["b.container"] = "[Container]\nImage=alpine\n"
	svc := NewUnitService(sd, fs, nil, "")

	units, err := svc.ListUnits(context.Background(), 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(units) != 2 {
		t.Errorf("expected 2 units, got %d", len(units))
	}
}

// --- FileService tests ---

func TestFileService_WriteFile_ValidatesFilename(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	err := svc.WriteFile(context.Background(), 0, "../etc/passwd", "evil")
	if err == nil {
		t.Fatal("expected validation error for directory traversal")
	}
}

func TestFileService_WriteFile_RejectsInvalidExtension(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	err := svc.WriteFile(context.Background(), 0, "notes.txt", "content")
	if err == nil {
		t.Fatal("expected validation error for .txt extension")
	}
}

func TestFileService_ApplyFile_WritesAndStarts(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	sd.Units["nginx.service"] = model.UnitStatus{
		Name: "nginx.service", ActiveState: "inactive", SubState: "dead",
	}
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	content := "[Container]\nImage=docker.io/nginx:latest\n"
	err := svc.ApplyFile(context.Background(), 0, "nginx.container", content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify file was written
	if fs.Files["nginx.container"] != content {
		t.Error("file content not written")
	}

	// Verify unit was started
	u, ok := sd.Units["nginx.service"]
	if !ok {
		t.Fatal("unit not registered after apply")
	}
	if u.ActiveState != "active" {
		t.Errorf("expected active, got %s", u.ActiveState)
	}
}

func TestFileService_ApplyFile_InvalidFilename(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	err := svc.ApplyFile(context.Background(), 0, "../../evil.container", "content")
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestFileService_ValidateContent_MissingImage(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	_, warnings, err := svc.ValidateContent("[Container]\nVolume=/data:/data\n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) == 0 {
		t.Fatal("expected warning about missing Image")
	}
}

func TestFileService_ValidateContent_ValidConfig(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	cfg, warnings, err := svc.ValidateContent("[Container]\nImage=nginx:latest\nPublishPort=80:80\n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) != 0 {
		t.Errorf("unexpected warnings: %v", warnings)
	}
	if cfg.Container.Image != "nginx:latest" {
		t.Errorf("expected image nginx:latest, got %s", cfg.Container.Image)
	}
}

func TestFileService_DeleteFile(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	fs.Files["old.container"] = "[Container]\nImage=alpine\n"
	svc := NewFileService(fs, sd, nil, "")

	err := svc.DeleteFile(context.Background(), 0, "old.container")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := fs.Files["old.container"]; ok {
		t.Error("file should have been deleted")
	}
}

// --- ValidateContent edge cases (TDD RED: these expose missing validation) ---

func TestFileService_ValidateContent_EmptyContent(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	_, _, err := svc.ValidateContent("")
	if err == nil {
		t.Fatal("expected error for empty content")
	}
}

func TestFileService_ValidateContent_NoContainerSection(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	_, warnings, err := svc.ValidateContent("[Unit]\nDescription=test\n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	found := false
	for _, w := range warnings {
		if w == "missing [Container] section" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected 'missing [Container] section' warning, got: %v", warnings)
	}
}

func TestFileService_ValidateContent_MultipleWarnings(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	// Container section with no Image
	_, warnings, err := svc.ValidateContent("[Container]\nVolume=/data:/data\n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) < 1 {
		t.Fatal("expected at least 1 warning")
	}
}

func TestFileService_ApplyFile_VolumeUnit(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	sd.Units["data.volume"] = model.UnitStatus{
		Name: "data.volume", ActiveState: "inactive", SubState: "dead",
	}
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	err := svc.ApplyFile(context.Background(), 0, "data.volume", "[Volume]\nVolumeName=data\n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := fs.Files["data.volume"]; !ok {
		t.Error("volume file not written")
	}
}

func TestFileService_ReadFile_NotFound(t *testing.T) {
	sd := provider.NewMockSystemd(true)
	fs := provider.NewMockQuadletFS()
	svc := NewFileService(fs, sd, nil, "")

	_, err := svc.ReadFile(context.Background(), 0, "nonexistent.container")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}
