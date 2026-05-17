package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type ContainerHandler struct {
	containers *service.ContainerService
}

func NewContainerHandler(containers *service.ContainerService) *ContainerHandler {
	return &ContainerHandler{containers: containers}
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

func (h *ContainerHandler) ListImages(c *gin.Context) {
	images, err := h.containers.ListImages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

func (h *ContainerHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.containers.ListVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volumes)
}

func (h *ContainerHandler) ListNetworks(c *gin.Context) {
	networks, err := h.containers.ListNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}
