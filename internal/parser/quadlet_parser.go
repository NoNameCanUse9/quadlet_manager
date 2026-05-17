package parser

import (
	"bufio"
	"strings"
)

type QuadletConfig struct {
	Unit      map[string]string
	Container ContainerSection
	Service   map[string]string
	Install   map[string]string
	// Raw sections for types we don't fully parse (Volume, Network, Pod, etc.)
	Raw map[string]map[string]string
}

type ContainerSection struct {
	Image       string
	PublishPort []string
	Volume      []string
	Environment []string
	User        string
	Group       string
	PodmanArgs  []string
	Label       []string
	AutoUpdate  string
	Exec        string
	HostName    string
	Network     string
}

// multiValueKeys are keys that can appear multiple times in a section.
var multiValueKeys = map[string]bool{
	"PublishPort": true,
	"Volume":      true,
	"Environment": true,
	"Label":       true,
	"PodmanArgs":  true,
}

// ParseQuadletFile parses a Quadlet INI file into a QuadletConfig.
func ParseQuadletFile(content string) (*QuadletConfig, error) {
	cfg := &QuadletConfig{
		Unit:    make(map[string]string),
		Service: make(map[string]string),
		Install: make(map[string]string),
		Raw:     make(map[string]map[string]string),
	}

	scanner := bufio.NewScanner(strings.NewReader(content))
	currentSection := ""

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Section header
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = line[1 : len(line)-1]
			if currentSection != "Unit" && currentSection != "Container" &&
				currentSection != "Service" && currentSection != "Install" {
				if _, ok := cfg.Raw[currentSection]; !ok {
					cfg.Raw[currentSection] = make(map[string]string)
				}
			}
			continue
		}

		// Key=Value
		eq := strings.Index(line, "=")
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		value := strings.TrimSpace(line[eq+1:])

		switch currentSection {
		case "Unit":
			cfg.Unit[key] = value
		case "Service":
			cfg.Service[key] = value
		case "Install":
			cfg.Install[key] = value
		case "Container":
			parseContainerKey(cfg, key, value)
		default:
			if section, ok := cfg.Raw[currentSection]; ok {
				if existing, exists := section[key]; exists {
					section[key] = existing + "\n" + value
				} else {
					section[key] = value
				}
			}
		}
	}

	return cfg, scanner.Err()
}

func parseContainerKey(cfg *QuadletConfig, key, value string) {
	switch key {
	case "Image":
		cfg.Container.Image = value
	case "PublishPort":
		cfg.Container.PublishPort = append(cfg.Container.PublishPort, value)
	case "Volume":
		cfg.Container.Volume = append(cfg.Container.Volume, value)
	case "Environment":
		cfg.Container.Environment = append(cfg.Container.Environment, value)
	case "User":
		cfg.Container.User = value
	case "Group":
		cfg.Container.Group = value
	case "PodmanArgs":
		cfg.Container.PodmanArgs = append(cfg.Container.PodmanArgs, value)
	case "Label":
		cfg.Container.Label = append(cfg.Container.Label, value)
	case "AutoUpdate":
		cfg.Container.AutoUpdate = value
	case "Exec":
		cfg.Container.Exec = value
	case "HostName":
		cfg.Container.HostName = value
	case "Network":
		cfg.Container.Network = value
	}
}
