package handler

import (
	"io"
	"net/http"

	"github.com/choken/quadlet-manager/internal/service"
	"github.com/gin-gonic/gin"
)

type BackupHandler struct {
	backup *service.BackupService
}

func NewBackupHandler(backup *service.BackupService) *BackupHandler {
	return &BackupHandler{backup: backup}
}

func (h *BackupHandler) ExportBackup(c *gin.Context) {
	userID := c.GetInt64("user_id")
	data, err := h.backup.Export(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=quadlet-backup.tar.gz")
	c.Header("Content-Type", "application/gzip")
	c.Data(http.StatusOK, "application/gzip", data)
}

func (h *BackupHandler) ImportBackup(c *gin.Context) {
	file, _, err := c.Request.FormFile("backup")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing backup file"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.backup.Import(c.Request.Context(), data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restored"})
}
