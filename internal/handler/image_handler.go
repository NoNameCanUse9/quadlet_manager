package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

type ImageHandler struct {
	images *service.ImageService
	hub    *ws.Hub
}

func NewImageHandler(images *service.ImageService, hub *ws.Hub) *ImageHandler {
	return &ImageHandler{images: images, hub: hub}
}

func (h *ImageHandler) ListImages(c *gin.Context) {
	images, err := h.images.ListImages(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, images)
}

func (h *ImageHandler) PullImage(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetInt64("user_id")
	taskID := generateID()
	c.JSON(http.StatusOK, gin.H{"task_id": taskID})

	go func() {
		reader, err := h.images.PullImage(c.Request.Context(), userID, req.Name)
		if err != nil {
			h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: map[string]any{
				"task_id": taskID, "status": "error", "error": err.Error(),
			}})
			return
		}
		defer reader.Close()

		decoder := json.NewDecoder(reader)
		for {
			var progress map[string]any
			if err := decoder.Decode(&progress); err != nil {
				break
			}
			progress["task_id"] = taskID
			progress["type"] = "pull_progress"
			h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: progress})
		}

		h.hub.Broadcast(ws.Message{Type: "pull_progress", Data: map[string]any{
			"task_id": taskID, "status": "complete",
		}})
	}()
}

func (h *ImageHandler) RemoveImage(c *gin.Context) {
	force := c.Query("force") == "true"
	if err := h.images.RemoveImage(c.Request.Context(), c.Param("id"), force); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func (h *ImageHandler) InspectImage(c *gin.Context) {
	info, err := h.images.InspectImage(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
