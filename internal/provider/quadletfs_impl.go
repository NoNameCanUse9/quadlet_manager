package provider

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/choken/quadlet-manager/internal/model"
)

// QuadletFSImpl implements QuadletFS using the local filesystem.
type QuadletFSImpl struct {
	baseDir string
}

func NewQuadletFSImpl(baseDir string) *QuadletFSImpl {
	return &QuadletFSImpl{baseDir: baseDir}
}

func (fs *QuadletFSImpl) ScanDir(_ context.Context) ([]model.QuadletFile, error) {
	entries, err := os.ReadDir(fs.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			os.MkdirAll(fs.baseDir, 0755)
			return nil, nil
		}
		return nil, fmt.Errorf("read dir %s: %w", fs.baseDir, err)
	}

	var files []model.QuadletFile
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if err := validateFilename(name); err != nil {
			continue // skip non-quadlet files
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, model.QuadletFile{
			Name:    name,
			Path:    filepath.Join(fs.baseDir, name),
			ModTime: info.ModTime(),
			Type:    quadletType(name),
		})
	}
	return files, nil
}

func (fs *QuadletFSImpl) ReadFile(_ context.Context, filename string) (string, error) {
	if err := validateFilename(filename); err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(fs.baseDir, filename))
	if err != nil {
		return "", fmt.Errorf("read file %s: %w", filename, err)
	}
	return string(data), nil
}

func (fs *QuadletFSImpl) WriteFile(_ context.Context, filename string, content string) error {
	if err := validateFilename(filename); err != nil {
		return err
	}
	os.MkdirAll(fs.baseDir, 0755)
	path := filepath.Join(fs.baseDir, filename)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return fmt.Errorf("write file %s: %w", filename, err)
	}
	return nil
}

func (fs *QuadletFSImpl) DeleteFile(_ context.Context, filename string) error {
	if err := validateFilename(filename); err != nil {
		return err
	}
	path := filepath.Join(fs.baseDir, filename)
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete file %s: %w", filename, err)
	}
	return nil
}

func (fs *QuadletFSImpl) ValidateFilename(filename string) error {
	return validateFilename(filename)
}

// Ensure QuadletFSImpl satisfies the interface at compile time.
var _ QuadletFS = (*QuadletFSImpl)(nil)
