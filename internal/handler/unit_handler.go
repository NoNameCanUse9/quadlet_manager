package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

type UnitHandler struct {
	units *service.UnitService
	hub   *ws.Hub
}

func NewUnitHandler(units *service.UnitService, hub *ws.Hub) *UnitHandler {
	return &UnitHandler{units: units, hub: hub}
}

func (h *UnitHandler) ListUnits(c *gin.Context) {
	units, err := h.units.ListUnits(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, units)
}

func (h *UnitHandler) GetUnit(c *gin.Context) {
	name := c.Param("name")
	unit, err := h.units.GetUnitStatus(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if unit == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "unit not found"})
		return
	}
	c.JSON(http.StatusOK, unit)
}

func (h *UnitHandler) StartUnit(c *gin.Context) {
	name := c.Param("name")
	if err := h.units.StartUnit(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.hub.Broadcast(ws.Message{Type: "unit_status_changed", Data: gin.H{"name": name, "status": "active"}})
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (h *UnitHandler) StopUnit(c *gin.Context) {
	name := c.Param("name")
	if err := h.units.StopUnit(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.hub.Broadcast(ws.Message{Type: "unit_status_changed", Data: gin.H{"name": name, "status": "inactive"}})
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (h *UnitHandler) RestartUnit(c *gin.Context) {
	name := c.Param("name")
	if err := h.units.RestartUnit(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.hub.Broadcast(ws.Message{Type: "unit_status_changed", Data: gin.H{"name": name, "status": "active"}})
	c.JSON(http.StatusOK, gin.H{"status": "restarted"})
}

func (h *UnitHandler) EnableUnit(c *gin.Context) {
	name := c.Param("name")
	if err := h.units.EnableUnit(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "enabled"})
}

func (h *UnitHandler) DisableUnit(c *gin.Context) {
	name := c.Param("name")
	if err := h.units.DisableUnit(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "disabled"})
}

func (h *UnitHandler) DaemonReload(c *gin.Context) {
	if err := h.units.DaemonReload(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.hub.Broadcast(ws.Message{Type: "daemon_reloaded", Data: gin.H{}})
	c.JSON(http.StatusOK, gin.H{"status": "reloaded"})
}
