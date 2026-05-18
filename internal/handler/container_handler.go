package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type ContainerHandler struct {
	containers   *service.ContainerService
	orchestrator *service.ContainerOrchestrator
}

func NewContainerHandler(containers *service.ContainerService, orchestrator *service.ContainerOrchestrator) *ContainerHandler {
	return &ContainerHandler{containers: containers, orchestrator: orchestrator}
}

func (h *ContainerHandler) ListContainers(c *gin.Context) {
	containers, err := h.containers.ListContainers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, containers)
}

func (h *ContainerHandler) GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	tail := 100
	if t := c.Query("tail"); t != "" {
		if v, err := strconv.Atoi(t); err == nil && v > 0 {
			tail = v
		}
	}
	logs, err := h.containers.GetContainerLogs(c.Request.Context(), id, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "logs": logs})
}

func (h *ContainerHandler) StartContainer(c *gin.Context) {
	if err := h.orchestrator.Start(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "started"})
}

func (h *ContainerHandler) StopContainer(c *gin.Context) {
	if err := h.orchestrator.Stop(c.Request.Context(), c.Param("id"), nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (h *ContainerHandler) RestartContainer(c *gin.Context) {
	if err := h.orchestrator.Restart(c.Request.Context(), c.Param("id"), nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restarted"})
}

func (h *ContainerHandler) PauseContainer(c *gin.Context) {
	if err := h.containers.PauseContainer(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (h *ContainerHandler) UnpauseContainer(c *gin.Context) {
	if err := h.containers.UnpauseContainer(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "unpaused"})
}

func (h *ContainerHandler) RemoveContainer(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.orchestrator.Remove(c.Request.Context(), c.Param("id"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ContainerHandler) InspectContainer(c *gin.Context) {
	info, err := h.containers.InspectContainer(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *ContainerHandler) GetAutostart(c *gin.Context) {
	id := c.Param("id")
	enabled, err := h.orchestrator.GetAutostart(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"enabled": enabled})
}

func (h *ContainerHandler) SetAutostart(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.orchestrator.SetAutostart(c.Request.Context(), id, req.Enabled); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated", "enabled": req.Enabled})
}
