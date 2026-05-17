package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

// QuadletFS abstracts filesystem operations on Quadlet configuration files.
type QuadletFS interface {
	ScanDir(ctx context.Context) ([]model.QuadletFile, error)
	ReadFile(ctx context.Context, filename string) (string, error)
	WriteFile(ctx context.Context, filename string, content string) error
	DeleteFile(ctx context.Context, filename string) error
	ValidateFilename(filename string) error
}
