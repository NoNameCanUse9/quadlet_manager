package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/parser"
	"github.com/choken/quadlet-manager/internal/provider"
)

type SettingsLookup interface {
	GetByUserID(userID int64) (*model.UserSettings, error)
}

type FileService struct {
	defaultFS provider.QuadletFS
	systemd   provider.SystemdProvider
	settings  SettingsLookup
	defaultDir string
}

func NewFileService(fs provider.QuadletFS, systemd provider.SystemdProvider, settings SettingsLookup, defaultDir string) *FileService {
	return &FileService{defaultFS: fs, systemd: systemd, settings: settings, defaultDir: defaultDir}
}

func (s *FileService) resolveFS(ctx context.Context, userID int64) provider.QuadletFS {
	if s.settings != nil && userID > 0 {
		if st, err := s.settings.GetByUserID(userID); err == nil && st.QuadletDir != "" {
			return provider.NewQuadletFSImpl(st.QuadletDir)
		}
	}
	return s.defaultFS
}

func (s *FileService) ListFiles(ctx context.Context, userID int64) ([]model.QuadletFile, error) {
	return s.resolveFS(ctx, userID).ScanDir(ctx)
}

func (s *FileService) ReadFile(ctx context.Context, userID int64, filename string) (string, error) {
	if err := s.defaultFS.ValidateFilename(filename); err != nil {
		return "", err
	}
	return s.resolveFS(ctx, userID).ReadFile(ctx, filename)
}

func (s *FileService) WriteFile(ctx context.Context, userID int64, filename string, content string) error {
	if err := s.defaultFS.ValidateFilename(filename); err != nil {
		return err
	}
	return s.resolveFS(ctx, userID).WriteFile(ctx, filename, content)
}

func (s *FileService) DeleteFile(ctx context.Context, userID int64, filename string) error {
	if err := s.defaultFS.ValidateFilename(filename); err != nil {
		return err
	}
	return s.resolveFS(ctx, userID).DeleteFile(ctx, filename)
}

func (s *FileService) ApplyFile(ctx context.Context, userID int64, filename string, content string) error {
	if err := s.WriteFile(ctx, userID, filename, content); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	if err := s.systemd.DaemonReload(ctx); err != nil {
		return fmt.Errorf("daemon reload: %w", err)
	}
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
