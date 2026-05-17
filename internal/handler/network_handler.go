package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type NetworkHandler struct {
	networks *service.NetworkService
}

func NewNetworkHandler(networks *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{networks: networks}
}

func (h *NetworkHandler) ListNetworks(c *gin.Context) {
	networks, err := h.networks.ListNetworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}

func (h *NetworkHandler) CreateNetwork(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		Driver string `json:"driver"`
		Subnet string `json:"subnet"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.networks.CreateNetwork(c.Request.Context(), req.Name, req.Driver, req.Subnet); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created", "name": req.Name})
}

func (h *NetworkHandler) RemoveNetwork(c *gin.Context) {
	if err := h.networks.RemoveNetwork(c.Request.Context(), c.Param("name")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *NetworkHandler) InspectNetwork(c *gin.Context) {
	info, err := h.networks.InspectNetwork(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}
