package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"gopkg.in/yaml.v3"
)

// ComposeProviderImpl implements ComposeProvider using podman-compose / podman compose.
type ComposeProviderImpl struct {
	quadletDir string
}

func NewComposeProviderImpl(quadletDir string) *ComposeProviderImpl {
	return &ComposeProviderImpl{quadletDir: quadletDir}
}

func (p *ComposeProviderImpl) composeDir() string {
	return filepath.Join(p.quadletDir, ".compose")
}

func (p *ComposeProviderImpl) projectDir(name string) string {
	return filepath.Join(p.composeDir(), name)
}

func (p *ComposeProviderImpl) projectFile(name string) string {
	return filepath.Join(p.projectDir(name), "docker-compose.yml")
}

// ImportProject saves a docker-compose.yml to the project directory.
// If dir is non-empty, the project is stored under {dir}/.compose/{name}/ instead of the default quadletDir.
func (p *ComposeProviderImpl) ImportProject(ctx context.Context, name string, content string, dir string) error {
	if err := validateProjectName(name); err != nil {
		return err
	}
	base := p.quadletDir
	if dir != "" {
		base = dir
	}
	projectDir := filepath.Join(base, ".compose", name)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return fmt.Errorf("create project dir: %w", err)
	}
	return os.WriteFile(filepath.Join(projectDir, "docker-compose.yml"), []byte(content), 0o644)
}

// ListProjects scans the .compose directory for projects.
func (p *ComposeProviderImpl) ListProjects(ctx context.Context) ([]model.ComposeProject, error) {
	base := p.composeDir()
	entries, err := os.ReadDir(base)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.ComposeProject{}, nil
		}
		return nil, err
	}

	var projects []model.ComposeProject
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		ymlPath := filepath.Join(base, e.Name(), "docker-compose.yml")
		if _, err := os.Stat(ymlPath); err != nil {
			continue
		}

		status := "stopped"
		services, _ := p.projectServices(ctx, e.Name())
		if len(services) > 0 {
			allStopped := true
			for _, s := range services {
				if s.State == "running" {
					allStopped = false
					break
				}
			}
			if !allStopped {
				status = "running"
			}
		}

		projects = append(projects, model.ComposeProject{
			Name:     e.Name(),
			File:     ymlPath,
			Status:   status,
			Services: serviceNames(services),
		})
	}
	if projects == nil {
		return []model.ComposeProject{}, nil
	}
	return projects, nil
}

// RemoveProject deletes the project directory.
func (p *ComposeProviderImpl) RemoveProject(ctx context.Context, name string) error {
	if err := validateProjectName(name); err != nil {
		return err
	}
	dir := p.projectDir(name)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return fmt.Errorf("project %q not found", name)
	}
	return os.RemoveAll(dir)
}

// Up runs podman compose up -d for the project.
func (p *ComposeProviderImpl) Up(ctx context.Context, name string) error {
	if err := validateProjectName(name); err != nil {
		return err
	}
	return p.runCompose(ctx, name, "up", "-d")
}

// Down runs podman compose down for the project.
func (p *ComposeProviderImpl) Down(ctx context.Context, name string) error {
	if err := validateProjectName(name); err != nil {
		return err
	}
	return p.runCompose(ctx, name, "down")
}

// Ps returns the services in a compose project with their state.
func (p *ComposeProviderImpl) Ps(ctx context.Context, name string) ([]model.ComposeService, error) {
	if err := validateProjectName(name); err != nil {
		return nil, err
	}
	return p.projectServices(ctx, name)
}

// Logs returns logs for a specific service.
func (p *ComposeProviderImpl) Logs(ctx context.Context, name string, service string, tail int) ([]string, error) {
	if err := validateProjectName(name); err != nil {
		return nil, err
	}
	args := []string{"logs", "--no-color"}
	if tail > 0 {
		args = append(args, "--tail", strconv.Itoa(tail))
	}
	if service != "" {
		args = append(args, service)
	}
	out, err := p.composeOutput(ctx, name, args...)
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimRight(out, "\n"), "\n"), nil
}

// ConvertToQuadlet converts a docker-compose.yml to Quadlet file definitions.
func (p *ComposeProviderImpl) ConvertToQuadlet(ctx context.Context, name string) ([]model.QuadletConversion, error) {
	if err := validateProjectName(name); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p.projectFile(name))
	if err != nil {
		return nil, fmt.Errorf("read compose file: %w", err)
	}

	var compose composeFile
	if err := yaml.Unmarshal(data, &compose); err != nil {
		return nil, fmt.Errorf("parse compose file: %w", err)
	}

	var conversions []model.QuadletConversion
	for svcName, svc := range compose.Services {
		conv := convertService(name, svcName, svc)
		conversions = append(conversions, conv)
	}
	if conversions == nil {
		return []model.QuadletConversion{}, nil
	}
	return conversions, nil
}

// --- internal helpers ---

func (p *ComposeProviderImpl) runCompose(ctx context.Context, project string, args ...string) error {
	dir := p.projectDir(project)
	fullArgs := append([]string{"compose", "-f", p.projectFile(project)}, args...)
	cmd := exec.CommandContext(ctx, "podman", fullArgs...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func (p *ComposeProviderImpl) composeOutput(ctx context.Context, project string, args ...string) (string, error) {
	fullArgs := append([]string{"compose", "-f", p.projectFile(project)}, args...)
	cmd := exec.CommandContext(ctx, "podman", fullArgs...)
	cmd.Dir = p.projectDir(project)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("podman compose %s: %w\n%s", args[0], err, string(out))
	}
	return string(out), nil
}

func (p *ComposeProviderImpl) projectServices(ctx context.Context, name string) ([]model.ComposeService, error) {
	out, err := p.composeOutput(ctx, name, "ps", "--format", "json")
	if err != nil {
		return nil, err
	}
	return parseComposePs(out)
}

func parseComposePs(output string) ([]model.ComposeService, error) {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	var services []model.ComposeService
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// podman compose ps --format json outputs one JSON object per line
		var entry struct {
			Name   string `json:"Name"`
			State  string `json:"State"`
			Image  string `json:"Image"`
			Ports  string `json:"Ports"`
			Status string `json:"Status"`
		}
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			// fallback: try extracting name from line
			continue
		}
		services = append(services, model.ComposeService{
			Name:  entry.Name,
			State: strings.ToLower(entry.State),
			Image: entry.Image,
			Ports: entry.Ports,
		})
	}
	if services == nil {
		return []model.ComposeService{}, nil
	}
	return services, nil
}

func serviceNames(services []model.ComposeService) []string {
	names := make([]string, 0, len(services))
	for _, s := range services {
		names = append(names, s.Name)
	}
	return names
}

var validProjectName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

func validateProjectName(name string) error {
	if name == "" {
		return fmt.Errorf("project name is required")
	}
	if !validProjectName.MatchString(name) {
		return fmt.Errorf("invalid project name %q: must start with alphanumeric, contain only [a-zA-Z0-9._-]", name)
	}
	return nil
}

// --- compose file types for YAML parsing ---

type composeFile struct {
	Services map[string]composeService `yaml:"services"`
	Volumes  map[string]any            `yaml:"volumes,omitempty"`
	Networks map[string]any            `yaml:"networks,omitempty"`
}

type composeService struct {
	Image       string            `yaml:"image"`
	Ports       []string          `yaml:"ports"`
	Volumes     []string          `yaml:"volumes"`
	Environment map[string]string `yaml:"-"`
	Restart     string            `yaml:"restart"`
	Labels      map[string]string `yaml:"labels"`
	Networks    []string          `yaml:"networks"`
	Command     any               `yaml:"command"`
	Entrypoint  any               `yaml:"entrypoint"`
	Hostname    string            `yaml:"hostname"`
	Domainname  string            `yaml:"domainname"`
	Privileged  bool              `yaml:"privileged"`
	User        string            `yaml:"user"`
	WorkingDir  string            `yaml:"working_dir"`
	HealthCheck any               `yaml:"healthcheck"`
	DependsOn   any               `yaml:"depends_on"`
}

func (s *composeService) UnmarshalYAML(value *yaml.Node) error {
	// Use an alias to avoid infinite recursion
	type alias composeService
	raw := alias{}
	if err := value.Decode(&raw); err != nil {
		return err
	}
	*s = composeService(raw)

	// Parse environment: can be map or list
	var envRaw any
	envNode := yaml.Node{}
	found := false
	for i := 0; i < len(value.Content)-1; i += 2 {
		if value.Content[i].Value == "environment" {
			envNode = *value.Content[i+1]
			found = true
			break
		}
	}
	if found {
		if err := envNode.Decode(&envRaw); err == nil {
			s.Environment = parseEnv(envRaw)
		}
	}
	if s.Environment == nil {
		s.Environment = map[string]string{}
	}
	return nil
}

func toStringSlice(v any) []string {
	switch val := v.(type) {
	case []any:
		result := make([]string, 0, len(val))
		for _, item := range val {
			result = append(result, fmt.Sprintf("%v", item))
		}
		return result
	case []string:
		return val
	case string:
		return []string{val}
	}
	return nil
}

func parseEnv(raw any) map[string]string {
	switch v := raw.(type) {
	case map[string]any:
		m := make(map[string]string, len(v))
		for k, val := range v {
			m[k] = fmt.Sprintf("%v", val)
		}
		return m
	case []any:
		m := make(map[string]string, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				if idx := strings.Index(s, "="); idx >= 0 {
					m[s[:idx]] = s[idx+1:]
				}
			}
		}
		return m
	}
	return nil
}

// convertService converts a single docker-compose service to a Quadlet conversion.
func convertService(projectName, svcName string, svc composeService) model.QuadletConversion {
	var warnings []string
	var sections []string

	// [Unit] section
	unitLines := []string{
		"[Unit]",
		fmt.Sprintf("Description=%s - %s service", projectName, svcName),
	}
	if svc.DependsOn != nil {
		warnings = append(warnings, fmt.Sprintf("depends_on for %s is not directly supported in Quadlet; consider using systemd ordering", svcName))
	}
	sections = append(sections, strings.Join(unitLines, "\n"))

	// [Container] section
	var containerLines []string
	containerLines = append(containerLines, "[Container]")

	if svc.Image == "" {
		warnings = append(warnings, fmt.Sprintf("service %s has no image specified", svcName))
	} else {
		containerLines = append(containerLines, "Image="+svc.Image)
	}

	for _, port := range svc.Ports {
		containerLines = append(containerLines, "PublishPort="+port)
	}

	for _, vol := range svc.Volumes {
		containerLines = append(containerLines, "Volume="+vol)
	}

	for k, v := range svc.Environment {
		containerLines = append(containerLines, fmt.Sprintf("Environment=%s=%s", k, v))
	}

	for k, v := range svc.Labels {
		containerLines = append(containerLines, fmt.Sprintf("Label=%s=%s", k, v))
	}

	entrypoint := toStringSlice(svc.Entrypoint)
	command := toStringSlice(svc.Command)

	if len(entrypoint) > 0 {
		warnings = append(warnings, fmt.Sprintf("entrypoint for %s converted to Exec; entrypoint and command are merged", svcName))
		execParts := append(entrypoint, command...)
		containerLines = append(containerLines, "Exec="+strings.Join(execParts, " "))
	} else if len(command) > 0 {
		containerLines = append(containerLines, "Exec="+strings.Join(command, " "))
	}

	if svc.Hostname != "" {
		containerLines = append(containerLines, "HostName="+svc.Hostname)
	}

	if svc.User != "" {
		containerLines = append(containerLines, "User="+svc.User)
	}

	if svc.WorkingDir != "" {
		containerLines = append(containerLines, "WorkingDir="+svc.WorkingDir)
	}

	if svc.Privileged {
		containerLines = append(containerLines, "SecurityLabelDisable=true")
		warnings = append(warnings, fmt.Sprintf("privileged mode for %s mapped to SecurityLabelDisable; Podman handles this differently than Docker", svcName))
	}

	if svc.HealthCheck != nil {
		warnings = append(warnings, fmt.Sprintf("healthcheck for %s is not directly mapped; consider using HealthCmd, HealthInterval in Quadlet", svcName))
	}

	if len(svc.Networks) > 1 {
		warnings = append(warnings, fmt.Sprintf("service %s references multiple networks; Quadlet supports a single Network= directive", svcName))
	}

	sections = append(sections, strings.Join(containerLines, "\n"))

	// [Service] section
	serviceLines := []string{"[Service]"}
	restartPolicy := "always"
	if svc.Restart != "" {
		switch svc.Restart {
		case "no", "never":
			restartPolicy = "no"
		case "always", "unless-stopped":
			restartPolicy = "always"
		case "on-failure":
			restartPolicy = "on-failure"
		default:
			restartPolicy = "always"
		}
	}
	serviceLines = append(serviceLines, "Restart="+restartPolicy)
	sections = append(sections, strings.Join(serviceLines, "\n"))

	// [Install] section
	sections = append(sections, "[Install]\nWantedBy=default.target")

	return model.QuadletConversion{
		Filename: svcName + ".container",
		Content:  strings.Join(sections, "\n\n") + "\n",
		Warnings: warnings,
	}
}
