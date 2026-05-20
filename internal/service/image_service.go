package service

import (
	"context"
	"io"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type ImageService struct {
	podman   provider.PodmanProvider
	settings SettingsLookup
}

func NewImageService(podman provider.PodmanProvider, settings SettingsLookup) *ImageService {
	return &ImageService{podman: podman, settings: settings}
}

func (s *ImageService) ListImages(ctx context.Context) ([]model.ImageInfo, error) {
	return s.podman.ListImages(ctx)
}

func (s *ImageService) PullImage(ctx context.Context, userID int64, name string) (io.ReadCloser, error) {
	name = s.applyMirror(ctx, userID, name)
	return s.podman.PullImage(ctx, name)
}

func (s *ImageService) applyMirror(ctx context.Context, userID int64, name string) string {
	if s.settings == nil || userID <= 0 {
		return name
	}
	st, err := s.settings.GetByUserID(userID)
	if err != nil || st.MirrorRegistry == "" {
		return name
	}
	// Skip if name already has a registry prefix (contains a dot before the first slash)
	// e.g. ghcr.io/foo/bar, docker.io/library/nginx
	parts := strings.SplitN(name, "/", 2)
	if len(parts) > 1 && strings.Contains(parts[0], ".") {
		return name
	}
	// Skip if name starts with http/https
	if strings.HasPrefix(name, "http://") || strings.HasPrefix(name, "https://") {
		return name
	}
	return strings.TrimRight(st.MirrorRegistry, "/") + "/" + name
}

func (s *ImageService) RemoveImage(ctx context.Context, id string, force bool) error {
	return s.podman.RemoveImage(ctx, id, force)
}

func (s *ImageService) InspectImage(ctx context.Context, id string) (map[string]any, error) {
	return s.podman.InspectImage(ctx, id)
}
