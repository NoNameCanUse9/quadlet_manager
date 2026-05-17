package service

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"

	"github.com/choken/quadlet-manager/internal/provider"
)

type BackupService struct {
	quadletFS provider.QuadletFS
	settings  SettingsLookup
}

func NewBackupService(fs provider.QuadletFS, settings SettingsLookup) *BackupService {
	return &BackupService{quadletFS: fs, settings: settings}
}

// Export creates a tar.gz of all quadlet files + settings.
func (s *BackupService) Export(ctx context.Context, userID int64) ([]byte, error) {
	files, err := s.quadletFS.ScanDir(ctx)
	if err != nil {
		return nil, fmt.Errorf("scan quadlet dir: %w", err)
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	for _, f := range files {
		header := &tar.Header{
			Name: f.Name,
			Mode: 0644,
			Size: int64(len(f.Content)),
		}
		if err := tw.WriteHeader(header); err != nil {
			return nil, err
		}
		if _, err := tw.Write([]byte(f.Content)); err != nil {
			return nil, err
		}
	}

	if s.settings != nil {
		settings, err := s.settings.GetByUserID(userID)
		if err == nil && settings != nil {
			settingsJSON, _ := json.MarshalIndent(settings, "", "  ")
			header := &tar.Header{
				Name: "settings.json",
				Mode: 0644,
				Size: int64(len(settingsJSON)),
			}
			if err := tw.WriteHeader(header); err != nil {
				return nil, err
			}
			tw.Write(settingsJSON)
		}
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Import extracts a tar.gz into the quadlet directory.
func (s *BackupService) Import(ctx context.Context, data []byte) error {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("invalid gzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	validExts := []string{".container", ".volume", ".network", ".pod", ".kube", ".image"}

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read tar: %w", err)
		}

		name := filepath.Base(header.Name)
		if name != header.Name {
			return fmt.Errorf("invalid filename (directory traversal): %s", header.Name)
		}

		if name == "settings.json" {
			continue
		}

		ext := filepath.Ext(name)
		valid := false
		for _, v := range validExts {
			if ext == v {
				valid = true
				break
			}
		}
		if !valid {
			continue
		}

		content, err := io.ReadAll(tr)
		if err != nil {
			return fmt.Errorf("read file %s: %w", name, err)
		}

		if err := s.quadletFS.WriteFile(ctx, name, string(content)); err != nil {
			return fmt.Errorf("write file %s: %w", name, err)
		}
	}
	return nil
}
