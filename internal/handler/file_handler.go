package handler

import (
	"net/http"
	"strings"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type FileHandler struct {
	files *service.FileService
}

func NewFileHandler(files *service.FileService) *FileHandler {
	return &FileHandler{files: files}
}

func (h *FileHandler) ListFiles(c *gin.Context) {
	userID := c.GetInt64("user_id")
	files, err := h.files.ListFiles(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, files)
}

func (h *FileHandler) ReadFile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	filename := c.Param("filename")
	content, err := h.files.ReadFile(c.Request.Context(), userID, filename)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"filename": filename, "content": content})
}

type fileRequest struct {
	Filename string `json:"filename" binding:"required"`
	Content  string `json:"content"`
}

func (h *FileHandler) CreateFile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req fileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.files.WriteFile(c.Request.Context(), userID, req.Filename, req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created", "filename": req.Filename})
}

func (h *FileHandler) UpdateFile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	filename := c.Param("filename")
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.files.WriteFile(c.Request.Context(), userID, filename, req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated", "filename": filename})
}

func (h *FileHandler) DeleteFile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	filename := c.Param("filename")
	if err := h.files.DeleteFile(c.Request.Context(), userID, filename); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted", "filename": filename})
}

func (h *FileHandler) ApplyFile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	filename := c.Param("filename")
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Content)) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "applied content cannot be empty"})
		return
	}
	if err := h.files.ApplyFile(c.Request.Context(), userID, filename, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "applied", "filename": filename})
}

type validateRequest struct {
	Content string `json:"content" binding:"required"`
}

func (h *FileHandler) ValidateFile(c *gin.Context) {
	var req validateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(strings.TrimSpace(req.Content)) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": "validation content cannot be empty"})
		return
	}
	cfg, warnings, err := h.files.ValidateContent(req.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": true, "warnings": warnings, "config": cfg})
}
