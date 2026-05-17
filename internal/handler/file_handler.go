package handler

import (
	"net/http"

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
	files, err := h.files.ListFiles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, files)
}

func (h *FileHandler) ReadFile(c *gin.Context) {
	filename := c.Param("filename")
	content, err := h.files.ReadFile(c.Request.Context(), filename)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"filename": filename, "content": content})
}

type fileRequest struct {
	Filename string `json:"filename" binding:"required"`
	Content  string `json:"content" binding:"required"`
}

func (h *FileHandler) CreateFile(c *gin.Context) {
	var req fileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.files.WriteFile(c.Request.Context(), req.Filename, req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created", "filename": req.Filename})
}

func (h *FileHandler) UpdateFile(c *gin.Context) {
	filename := c.Param("filename")
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.files.WriteFile(c.Request.Context(), filename, req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated", "filename": filename})
}

func (h *FileHandler) DeleteFile(c *gin.Context) {
	filename := c.Param("filename")
	if err := h.files.DeleteFile(c.Request.Context(), filename); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted", "filename": filename})
}

func (h *FileHandler) ApplyFile(c *gin.Context) {
	filename := c.Param("filename")
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.files.ApplyFile(c.Request.Context(), filename, req.Content); err != nil {
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
	cfg, warnings, err := h.files.ValidateContent(req.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": true, "warnings": warnings, "config": cfg})
}
