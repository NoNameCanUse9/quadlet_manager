package config

import (
	"errors"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
)

type Config struct {
	Port         int
	Rootless     bool
	QuadletDir   string
	PodmanSocket string
	DevMode      bool
}

type Options struct {
	Port         int
	Rootless     *bool // nil = auto-detect
	QuadletDir   string
	PodmanSocket string
	DevMode      bool
}

func New(opts Options) Config {
	rootless := os.Getuid() != 0
	if opts.Rootless != nil {
		rootless = *opts.Rootless
	}

	port := opts.Port
	if port == 0 {
		port = 8080
	}

	quadletDir := opts.QuadletDir
	if quadletDir == "" {
		quadletDir = defaultQuadletDir(rootless)
	}

	podmanSocket := opts.PodmanSocket
	if podmanSocket == "" {
		podmanSocket = defaultPodmanSocket(rootless)
	}

	return Config{
		Port:         port,
		Rootless:     rootless,
		QuadletDir:   quadletDir,
		PodmanSocket: podmanSocket,
		DevMode:      opts.DevMode,
	}
}

func (c Config) Validate() error {
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("invalid port: %d", c.Port)
	}
	if c.QuadletDir == "" {
		return errors.New("QuadletDir is required")
	}
	if c.PodmanSocket == "" {
		return errors.New("PodmanSocket is required")
	}
	return nil
}

func defaultQuadletDir(rootless bool) string {
	if rootless {
		if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
			return filepath.Join(xdg, "containers", "systemd")
		}
		if u, err := user.Current(); err == nil {
			return filepath.Join(u.HomeDir, ".config", "containers", "systemd")
		}
		return filepath.Join(os.Getenv("HOME"), ".config", "containers", "systemd")
	}
	return "/etc/containers/systemd"
}

func defaultPodmanSocket(rootless bool) string {
	if rootless {
		uid := strconv.Itoa(os.Getuid())
		if xdg := os.Getenv("XDG_RUNTIME_DIR"); xdg != "" {
			return filepath.Join(xdg, "podman", "podman.sock")
		}
		return filepath.Join("/run", "user", uid, "podman", "podman.sock")
	}
	return "/run/podman/podman.sock"
}
