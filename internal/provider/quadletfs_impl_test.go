package provider

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestValidateFilename(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid container", "nginx.container", false},
		{"valid volume", "data.volume", false},
		{"valid network", "mynet.network", false},
		{"valid pod", "mypod.pod", false},
		{"valid kube", "app.kube", false},
		{"valid image", "base.image", false},
		{"invalid extension", "nginx.txt", true},
		{"no extension", "nginx", true},
		{"traversal parent", "../nginx.container", true},
		{"traversal absolute", "/etc/nginx.container", true},
		{"traversal nested", "subdir/nginx.container", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateFilename(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateFilename(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestQuadletFSImplScanDir(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "nginx.container"), []byte("[Container]\nImage=nginx\n"), 0644)
	os.WriteFile(filepath.Join(dir, "data.volume"), []byte("[Volume]\nLabel=test\n"), 0644)
	os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("not a quadlet"), 0644)

	fs := NewQuadletFSImpl(dir)
	files, err := fs.ScanDir(context.Background())
	if err != nil {
		t.Fatalf("ScanDir() error: %v", err)
	}
	if len(files) != 2 {
		t.Errorf("expected 2 quadlet files, got %d", len(files))
	}
}

func TestQuadletFSImplReadWrite(t *testing.T) {
	dir := t.TempDir()
	fs := NewQuadletFSImpl(dir)

	content := "[Container]\nImage=test:latest\n"
	err := fs.WriteFile(context.Background(), "test.container", content)
	if err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	read, err := fs.ReadFile(context.Background(), "test.container")
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}
	if read != content {
		t.Errorf("content mismatch: got %q, want %q", read, content)
	}
}

func TestQuadletFSImplDelete(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "old.container"), []byte("[Container]\nImage=old\n"), 0644)

	fs := NewQuadletFSImpl(dir)
	err := fs.DeleteFile(context.Background(), "old.container")
	if err != nil {
		t.Fatalf("DeleteFile() error: %v", err)
	}

	_, err = fs.ReadFile(context.Background(), "old.container")
	if err == nil {
		t.Error("expected error reading deleted file")
	}
}

func TestQuadletFSImplWriteRejectsTraversal(t *testing.T) {
	dir := t.TempDir()
	fs := NewQuadletFSImpl(dir)

	err := fs.WriteFile(context.Background(), "../evil.container", "bad")
	if err == nil {
		t.Error("expected error for traversal filename")
	}
}
