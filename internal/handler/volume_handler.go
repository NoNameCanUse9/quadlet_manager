package handler

import (
	"io"
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type VolumeHandler struct {
	volumes *service.VolumeService
}

func NewVolumeHandler(volumes *service.VolumeService) *VolumeHandler {
	return &VolumeHandler{volumes: volumes}
}

func (h *VolumeHandler) ListVolumes(c *gin.Context) {
	volumes, err := h.volumes.ListVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, volumes)
}

func (h *VolumeHandler) CreateVolume(c *gin.Context) {
	var req struct {
		Name   string            `json:"name" binding:"required"`
		Labels map[string]string `json:"labels"`
		Device string            `json:"device"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var opts map[string]string
	if req.Device != "" {
		opts = map[string]string{
			"device": req.Device,
			"type":   "none",
			"o":      "bind",
		}
	}
	vol, err := h.volumes.CreateVolume(c.Request.Context(), req.Name, req.Labels, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, vol)
}

func (h *VolumeHandler) RemoveVolume(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.volumes.RemoveVolume(c.Request.Context(), c.Param("name"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *VolumeHandler) InspectVolume(c *gin.Context) {
	info, err := h.volumes.InspectVolume(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *VolumeHandler) ExportVolume(c *gin.Context) {
	reader, err := h.volumes.ExportVolume(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer reader.Close()
	c.Header("Content-Type", "application/x-tar")
	c.Header("Content-Disposition", "attachment; filename="+c.Param("name")+".tar")
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, reader); err != nil {
		// Connection may have been closed by client
		return
	}
}

func (h *VolumeHandler) ImportVolume(c *gin.Context) {
	if err := h.volumes.ImportVolume(c.Request.Context(), c.Param("name"), c.Request.Body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "imported"})
}

func (h *VolumeHandler) PruneVolumes(c *gin.Context) {
	count, err := h.volumes.PruneVolumes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"pruned": count})
}
