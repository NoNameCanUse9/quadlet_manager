package handler

import (
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

type StatsHandler struct {
	containers *service.ContainerService
	hub        *ws.Hub
}

func NewStatsHandler(containers *service.ContainerService, hub *ws.Hub) *StatsHandler {
	return &StatsHandler{containers: containers, hub: hub}
}

func (h *StatsHandler) GetStats(c *gin.Context) {
	stats, err := h.containers.GetAllStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"containers": stats})
}

func (h *StatsHandler) HandleWebSocket(c *gin.Context) {
	h.hub.HandleWebSocket(c)
}
