package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/parser"
	"github.com/choken/quadlet-manager/internal/provider"
)

type FileService struct {
	fs      provider.QuadletFS
	systemd provider.SystemdProvider
}

func NewFileService(fs provider.QuadletFS, systemd provider.SystemdProvider) *FileService {
	return &FileService{fs: fs, systemd: systemd}
}

func (s *FileService) ListFiles(ctx context.Context) ([]model.QuadletFile, error) {
	return s.fs.ScanDir(ctx)
}

func (s *FileService) ReadFile(ctx context.Context, filename string) (string, error) {
	if err := s.fs.ValidateFilename(filename); err != nil {
		return "", err
	}
	return s.fs.ReadFile(ctx, filename)
}

func (s *FileService) WriteFile(ctx context.Context, filename string, content string) error {
	if err := s.fs.ValidateFilename(filename); err != nil {
		return err
	}
	return s.fs.WriteFile(ctx, filename, content)
}

func (s *FileService) DeleteFile(ctx context.Context, filename string) error {
	if err := s.fs.ValidateFilename(filename); err != nil {
		return err
	}
	return s.fs.DeleteFile(ctx, filename)
}

func (s *FileService) ApplyFile(ctx context.Context, filename string, content string) error {
	if err := s.WriteFile(ctx, filename, content); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	if err := s.systemd.DaemonReload(ctx); err != nil {
		return fmt.Errorf("daemon reload: %w", err)
	}
	// Derive the systemd unit name from the filename.
	// e.g. "nginx.container" -> "nginx.service"
	unitName := filenameToUnitName(filename)
	if unitName != "" {
		if err := s.systemd.StartUnit(ctx, unitName); err != nil {
			return fmt.Errorf("start unit %s: %w", unitName, err)
		}
	}
	return nil
}

func (s *FileService) ValidateContent(content string) (*parser.QuadletConfig, []string, error) {
	if strings.TrimSpace(content) == "" {
		return nil, nil, fmt.Errorf("content is empty")
	}
	cfg, err := parser.ParseQuadletFile(content)
	if err != nil {
		return nil, nil, err
	}
	var warnings []string
	if cfg.Container.Image == "" && len(cfg.Container.PublishPort) == 0 &&
		len(cfg.Container.Volume) == 0 && len(cfg.Container.Environment) == 0 {
		warnings = append(warnings, "missing [Container] section")
	} else if cfg.Container.Image == "" {
		warnings = append(warnings, "missing Image directive in [Container] section")
	}
	return cfg, warnings, nil
}

// filenameToUnitName converts a Quadlet filename to its systemd unit name.
func filenameToUnitName(filename string) string {
	ext := strings.LastIndex(filename, ".")
	if ext < 0 {
		return ""
	}
	base := filename[:ext]
	suffix := filename[ext+1:]
	switch suffix {
	case "container":
		return base + ".service"
	case "volume":
		return base + ".volume"
	case "network":
		return base + ".network"
	case "pod":
		return base + ".pod"
	case "kube":
		return base + ".service"
	case "image":
		return base + ".image"
	default:
		return ""
	}
}
