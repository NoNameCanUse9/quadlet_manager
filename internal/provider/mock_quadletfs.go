package provider

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/choken/quadlet-manager/internal/model"
)

// MockQuadletFS is a test double for QuadletFS.
type MockQuadletFS struct {
	Files map[string]string // filename -> content
	Err   error
}

func NewMockQuadletFS() *MockQuadletFS {
	return &MockQuadletFS{
		Files: make(map[string]string),
	}
}

func (m *MockQuadletFS) ScanDir(_ context.Context) ([]model.QuadletFile, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	var files []model.QuadletFile
	for name, content := range m.Files {
		files = append(files, model.QuadletFile{
			Name:    name,
			Path:    "/mock/" + name,
			Content: content,
			ModTime: time.Now(),
			Type:    quadletType(name),
		})
	}
	return files, nil
}

func (m *MockQuadletFS) ReadFile(_ context.Context, filename string) (string, error) {
	if m.Err != nil {
		return "", m.Err
	}
	content, ok := m.Files[filename]
	if !ok {
		return "", fmt.Errorf("file not found: %s", filename)
	}
	return content, nil
}

func (m *MockQuadletFS) WriteFile(_ context.Context, filename string, content string) error {
	if m.Err != nil {
		return m.Err
	}
	m.Files[filename] = content
	return nil
}

func (m *MockQuadletFS) DeleteFile(_ context.Context, filename string) error {
	if m.Err != nil {
		return m.Err
	}
	delete(m.Files, filename)
	return nil
}

func (m *MockQuadletFS) ValidateFilename(filename string) error {
	return validateFilename(filename)
}

func quadletType(name string) string {
	switch {
	case strings.HasSuffix(name, ".container"):
		return "container"
	case strings.HasSuffix(name, ".volume"):
		return "volume"
	case strings.HasSuffix(name, ".network"):
		return "network"
	case strings.HasSuffix(name, ".pod"):
		return "pod"
	case strings.HasSuffix(name, ".kube"):
		return "kube"
	case strings.HasSuffix(name, ".image"):
		return "image"
	default:
		return "unknown"
	}
}

var validExtensions = []string{".container", ".volume", ".network", ".pod", ".kube", ".image"}

// validateFilename checks filename for valid extension and no directory traversal.
func validateFilename(filename string) error {
	if filename == "" {
		return fmt.Errorf("empty filename")
	}

	// Check for directory traversal
	clean := filepath.Clean(filename)
	if clean != filepath.Base(clean) {
		return fmt.Errorf("directory traversal not allowed: %s", filename)
	}
	if strings.ContainsAny(filename, "/\\") {
		return fmt.Errorf("directory traversal not allowed: %s", filename)
	}

	// Check extension
	ext := fileExtension(filename)
	valid := false
	for _, v := range validExtensions {
		if ext == v {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid file extension: %s", ext)
	}

	return nil
}

func fileExtension(name string) string {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			return name[i:]
		}
	}
	return ""
}
