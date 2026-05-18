package provider

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertToQuadlet_BasicService(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	yml := `
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    restart: always
`
	if err := p.ImportProject(context.Background(), "myapp", yml, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	convs, err := p.ConvertToQuadlet(context.Background(), "myapp")
	if err != nil {
		t.Fatalf("ConvertToQuadlet: %v", err)
	}
	if len(convs) != 1 {
		t.Fatalf("expected 1 conversion, got %d", len(convs))
	}

	c := convs[0]
	if c.Filename != "web.container" {
		t.Errorf("filename: got %q, want web.container", c.Filename)
	}
	if !strings.Contains(c.Content, "Image=nginx:latest") {
		t.Error("missing Image=nginx:latest")
	}
	if !strings.Contains(c.Content, "PublishPort=8080:80") {
		t.Error("missing PublishPort=8080:80")
	}
	if !strings.Contains(c.Content, "Restart=always") {
		t.Error("missing Restart=always")
	}
	if !strings.Contains(c.Content, "[Install]") {
		t.Error("missing [Install] section")
	}
}

func TestConvertToQuadlet_VolumesAndEnv(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	yml := `
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: mydb
`
	if err := p.ImportProject(context.Background(), "myapp", yml, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	convs, err := p.ConvertToQuadlet(context.Background(), "myapp")
	if err != nil {
		t.Fatalf("ConvertToQuadlet: %v", err)
	}
	if len(convs) != 1 {
		t.Fatalf("expected 1 conversion, got %d", len(convs))
	}

	c := convs[0]
	if !strings.Contains(c.Content, "Volume=pgdata:/var/lib/postgresql/data") {
		t.Error("missing Volume directive")
	}
	if !strings.Contains(c.Content, "Environment=POSTGRES_PASSWORD=secret") {
		t.Error("missing POSTGRES_PASSWORD env")
	}
	if !strings.Contains(c.Content, "Environment=POSTGRES_DB=mydb") {
		t.Error("missing POSTGRES_DB env")
	}
}

func TestConvertToQuadlet_MultipleServices(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	yml := `
services:
  web:
    image: nginx:latest
  api:
    image: node:20
    command: ["node", "server.js"]
`
	if err := p.ImportProject(context.Background(), "stack", yml, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	convs, err := p.ConvertToQuadlet(context.Background(), "stack")
	if err != nil {
		t.Fatalf("ConvertToQuadlet: %v", err)
	}
	if len(convs) != 2 {
		t.Fatalf("expected 2 conversions, got %d", len(convs))
	}

	filenames := make(map[string]bool)
	for _, c := range convs {
		filenames[c.Filename] = true
	}
	if !filenames["web.container"] {
		t.Error("missing web.container")
	}
	if !filenames["api.container"] {
		t.Error("missing api.container")
	}
}

func TestConvertToQuadlet_NoImageWarning(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	yml := `
services:
  build-only:
    build: .
`
	if err := p.ImportProject(context.Background(), "app", yml, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	convs, err := p.ConvertToQuadlet(context.Background(), "app")
	if err != nil {
		t.Fatalf("ConvertToQuadlet: %v", err)
	}
	if len(convs) == 0 {
		t.Fatal("expected at least 1 conversion")
	}

	found := false
	for _, w := range convs[0].Warnings {
		if strings.Contains(w, "no image") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected 'no image' warning, got: %v", convs[0].Warnings)
	}
}

func TestConvertToQuadlet_RestartPolicies(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	tests := []struct {
		input  string
		expect string
	}{
		{"no", "no"},
		{"always", "always"},
		{"on-failure", "on-failure"},
		{"unless-stopped", "always"},
		{"", "always"},
	}

	for _, tt := range tests {
		yml := `
services:
  svc:
    image: alpine
    restart: ` + tt.input + `
`
		if err := p.ImportProject(context.Background(), "test-"+tt.expect, yml, ""); err != nil {
			t.Fatalf("ImportProject(%q): %v", tt.input, err)
		}
		convs, err := p.ConvertToQuadlet(context.Background(), "test-"+tt.expect)
		if err != nil {
			t.Fatalf("ConvertToQuadlet(%q): %v", tt.input, err)
		}
		if !strings.Contains(convs[0].Content, "Restart="+tt.expect) {
			t.Errorf("restart=%q: expected Restart=%s in:\n%s", tt.input, tt.expect, convs[0].Content)
		}
	}
}

func TestConvertToQuadlet_EntrypointAndCommand(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	yml := `
services:
  app:
    image: myapp:latest
    entrypoint: ["/entrypoint.sh"]
    command: ["--port", "3000"]
`
	if err := p.ImportProject(context.Background(), "myapp", yml, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	convs, err := p.ConvertToQuadlet(context.Background(), "myapp")
	if err != nil {
		t.Fatalf("ConvertToQuadlet: %v", err)
	}

	c := convs[0]
	if !strings.Contains(c.Content, "Exec=/entrypoint.sh --port 3000") {
		t.Errorf("expected merged Exec, got:\n%s", c.Content)
	}
	if len(c.Warnings) == 0 {
		t.Error("expected entrypoint warning")
	}
}

func TestValidateProjectName(t *testing.T) {
	tests := []struct {
		name    string
		wantErr bool
	}{
		{"myapp", false},
		{"my-app_v2", false},
		{"app.service", false},
		{"", true},
		{"../evil", true},
		{"-bad", true},
		{"with space", true},
	}
	for _, tt := range tests {
		err := validateProjectName(tt.name)
		if (err != nil) != tt.wantErr {
			t.Errorf("validateProjectName(%q): err=%v, wantErr=%v", tt.name, err, tt.wantErr)
		}
	}
}

func TestImportProject_CreatesFile(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	content := "services:\n  web:\n    image: nginx\n"
	if err := p.ImportProject(context.Background(), "test", content, ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	path := filepath.Join(dir, ".compose", "test", "docker-compose.yml")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(data) != content {
		t.Errorf("content mismatch:\ngot:  %q\nwant: %q", string(data), content)
	}
}

func TestImportProject_CustomDir(t *testing.T) {
	defaultDir := t.TempDir()
	customDir := t.TempDir()
	p := NewComposeProviderImpl(defaultDir)

	content := "services:\n  web:\n    image: nginx\n"
	if err := p.ImportProject(context.Background(), "myapp", content, customDir); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}

	// Should be under customDir, not defaultDir
	path := filepath.Join(customDir, ".compose", "myapp", "docker-compose.yml")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(data) != content {
		t.Errorf("content mismatch:\ngot:  %q\nwant: %q", string(data), content)
	}

	// Should NOT exist under defaultDir
	unexpected := filepath.Join(defaultDir, ".compose", "myapp", "docker-compose.yml")
	if _, err := os.Stat(unexpected); err == nil {
		t.Error("file should not exist under default dir")
	}
}

func TestRemoveProject(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	if err := p.ImportProject(context.Background(), "old", "services: {}", ""); err != nil {
		t.Fatalf("ImportProject: %v", err)
	}
	if err := p.RemoveProject(context.Background(), "old"); err != nil {
		t.Fatalf("RemoveProject: %v", err)
	}

	path := filepath.Join(dir, ".compose", "old")
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("project directory should have been removed")
	}
}

func TestListProjects_Empty(t *testing.T) {
	dir := t.TempDir()
	p := NewComposeProviderImpl(dir)

	projects, err := p.ListProjects(context.Background())
	if err != nil {
		t.Fatalf("ListProjects: %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("expected 0 projects, got %d", len(projects))
	}
}

func TestParseEnv(t *testing.T) {
	// map format
	m := parseEnv(map[string]any{"A": "1", "B": 2})
	if m["A"] != "1" || m["B"] != "2" {
		t.Errorf("map env: %v", m)
	}

	// list format
	m = parseEnv([]any{"FOO=bar", "BAZ=qux"})
	if m["FOO"] != "bar" || m["BAZ"] != "qux" {
		t.Errorf("list env: %v", m)
	}
}
