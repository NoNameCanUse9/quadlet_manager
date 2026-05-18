package provider

import (
	"context"

	"github.com/choken/quadlet-manager/internal/model"
)

type ComposeProvider interface {
	ImportProject(ctx context.Context, name string, content string, dir string) error
	ListProjects(ctx context.Context) ([]model.ComposeProject, error)
	RemoveProject(ctx context.Context, name string) error

	Up(ctx context.Context, name string) error
	Down(ctx context.Context, name string) error
	Ps(ctx context.Context, name string) ([]model.ComposeService, error)
	Logs(ctx context.Context, name string, service string, tail int) ([]string, error)

	ConvertToQuadlet(ctx context.Context, name string) ([]model.QuadletConversion, error)
}
