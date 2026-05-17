package parser

import (
	"fmt"
	"strings"
)

// GenerateQuadletFile produces a valid Quadlet INI file from a QuadletConfig.
func GenerateQuadletFile(cfg *QuadletConfig) string {
	var b strings.Builder

	// [Unit]
	if len(cfg.Unit) > 0 {
		b.WriteString("[Unit]\n")
		for k, v := range cfg.Unit {
			fmt.Fprintf(&b, "%s=%s\n", k, v)
		}
		b.WriteString("\n")
	}

	// [Container]
	if cfg.Container.Image != "" || len(cfg.Container.PublishPort) > 0 ||
		len(cfg.Container.Volume) > 0 || len(cfg.Container.Environment) > 0 {
		b.WriteString("[Container]\n")
		if cfg.Container.Image != "" {
			fmt.Fprintf(&b, "Image=%s\n", cfg.Container.Image)
		}
		for _, p := range cfg.Container.PublishPort {
			fmt.Fprintf(&b, "PublishPort=%s\n", p)
		}
		for _, v := range cfg.Container.Volume {
			fmt.Fprintf(&b, "Volume=%s\n", v)
		}
		for _, e := range cfg.Container.Environment {
			fmt.Fprintf(&b, "Environment=%s\n", e)
		}
		if cfg.Container.User != "" {
			fmt.Fprintf(&b, "User=%s\n", cfg.Container.User)
		}
		if cfg.Container.Group != "" {
			fmt.Fprintf(&b, "Group=%s\n", cfg.Container.Group)
		}
		for _, a := range cfg.Container.PodmanArgs {
			fmt.Fprintf(&b, "PodmanArgs=%s\n", a)
		}
		for _, l := range cfg.Container.Label {
			fmt.Fprintf(&b, "Label=%s\n", l)
		}
		if cfg.Container.AutoUpdate != "" {
			fmt.Fprintf(&b, "AutoUpdate=%s\n", cfg.Container.AutoUpdate)
		}
		if cfg.Container.Exec != "" {
			fmt.Fprintf(&b, "Exec=%s\n", cfg.Container.Exec)
		}
		if cfg.Container.HostName != "" {
			fmt.Fprintf(&b, "HostName=%s\n", cfg.Container.HostName)
		}
		if cfg.Container.Network != "" {
			fmt.Fprintf(&b, "Network=%s\n", cfg.Container.Network)
		}
		b.WriteString("\n")
	}

	// [Service]
	if len(cfg.Service) > 0 {
		b.WriteString("[Service]\n")
		for k, v := range cfg.Service {
			fmt.Fprintf(&b, "%s=%s\n", k, v)
		}
		b.WriteString("\n")
	}

	// [Install]
	if len(cfg.Install) > 0 {
		b.WriteString("[Install]\n")
		for k, v := range cfg.Install {
			fmt.Fprintf(&b, "%s=%s\n", k, v)
		}
	}

	return b.String()
}
