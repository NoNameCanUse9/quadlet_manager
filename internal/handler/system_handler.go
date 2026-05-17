package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	cfg     config.Config
	units   *service.UnitService
}

func NewSystemHandler(cfg config.Config, units *service.UnitService) *SystemHandler {
	return &SystemHandler{cfg: cfg, units: units}
}

type SystemInfo struct {
	Port     int    `json:"port"`
	Rootless bool   `json:"rootless"`
	QuadletDir string `json:"quadletDir"`
}

func (h *SystemHandler) GetSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, SystemInfo{
		Port:       h.cfg.Port,
		Rootless:   h.cfg.Rootless,
		QuadletDir: h.cfg.QuadletDir,
	})
}
