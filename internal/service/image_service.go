package service

import (
	"context"
	"io"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/provider"
)

type ImageService struct {
	podman provider.PodmanProvider
}

func NewImageService(podman provider.PodmanProvider) *ImageService {
	return &ImageService{podman: podman}
}

func (s *ImageService) ListImages(ctx context.Context) ([]model.ImageInfo, error) {
	return s.podman.ListImages(ctx)
}

func (s *ImageService) PullImage(ctx context.Context, name string) (io.ReadCloser, error) {
	return s.podman.PullImage(ctx, name)
}

func (s *ImageService) RemoveImage(ctx context.Context, id string, force bool) error {
	return s.podman.RemoveImage(ctx, id, force)
}

func (s *ImageService) InspectImage(ctx context.Context, id string) (map[string]any, error) {
	return s.podman.InspectImage(ctx, id)
}
