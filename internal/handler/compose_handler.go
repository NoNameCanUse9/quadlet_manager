package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/gin-gonic/gin"
)

type ComposeHandler struct {
	compose provider.ComposeProvider
}

func NewComposeHandler(compose provider.ComposeProvider) *ComposeHandler {
	return &ComposeHandler{compose: compose}
}

func (h *ComposeHandler) ListProjects(c *gin.Context) {
	projects, err := h.compose.ListProjects(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

func (h *ComposeHandler) ImportProject(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Content string `json:"content" binding:"required"`
		Dir     string `json:"dir"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.compose.ImportProject(c.Request.Context(), req.Name, req.Content, req.Dir); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "imported"})
}

func (h *ComposeHandler) RemoveProject(c *gin.Context) {
	name := c.Param("name")
	if err := h.compose.RemoveProject(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ComposeHandler) Up(c *gin.Context) {
	name := c.Param("name")
	if err := h.compose.Up(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "up"})
}

func (h *ComposeHandler) Down(c *gin.Context) {
	name := c.Param("name")
	if err := h.compose.Down(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "down"})
}

func (h *ComposeHandler) Ps(c *gin.Context) {
	name := c.Param("name")
	services, err := h.compose.Ps(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, services)
}

func (h *ComposeHandler) Logs(c *gin.Context) {
	name := c.Param("name")
	service := c.Query("service")
	tail := 100
	if t := c.Query("tail"); t != "" {
		if v, err := strconv.Atoi(t); err == nil && v > 0 {
			tail = v
		}
	}
	logs, err := h.compose.Logs(c.Request.Context(), name, service, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

func (h *ComposeHandler) ConvertToQuadlet(c *gin.Context) {
	name := c.Param("name")
	conversions, err := h.compose.ConvertToQuadlet(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, conversions)
}
