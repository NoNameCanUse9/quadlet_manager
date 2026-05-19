package handler

import (
	"context"
	"net/http"

	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/updater"
	"github.com/choken/quadlet-manager/internal/version"
	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	cfg     config.Config
	units   *service.UnitService
	checker *updater.Checker
}

func NewSystemHandler(cfg config.Config, units *service.UnitService) *SystemHandler {
	return &SystemHandler{cfg: cfg, units: units}
}

func (h *SystemHandler) SetChecker(c *updater.Checker) {
	h.checker = c
}

type SystemInfo struct {
	Port       int    `json:"port"`
	Rootless   bool   `json:"rootless"`
	QuadletDir string `json:"quadletDir"`
	Version    string `json:"version"`
}

func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, SystemInfo{
		Port:       h.cfg.Port,
		Rootless:   h.cfg.Rootless,
		QuadletDir: h.cfg.QuadletDir,
		Version:    version.Version,
	})
}

// GetUpdateInfo returns the cached update check result.
func (h *SystemHandler) GetUpdateInfo(c *gin.Context) {
	if h.checker == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "updater not configured"})
		return
	}
	info := h.checker.GetCached()
	if info == nil {
		// Never checked yet — return no-update placeholder
		c.JSON(http.StatusOK, updater.UpdateInfo{
			Current:   version.Version,
			HasUpdate: false,
		})
		return
	}
	c.JSON(http.StatusOK, info)
}

// CheckUpdate triggers an immediate update check.
func (h *SystemHandler) CheckUpdate(c *gin.Context) {
	if h.checker == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "updater not configured"})
		return
	}
	info, err := h.checker.Check(context.Background())
	if err != nil {
		// Return cached if available, otherwise error
		cached := h.checker.GetCached()
		if cached != nil {
			c.JSON(http.StatusOK, cached)
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
