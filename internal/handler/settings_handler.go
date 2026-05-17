package handler

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	auth *auth.Service
}

func NewSettingsHandler(authSvc *auth.Service) *SettingsHandler {
	return &SettingsHandler{auth: authSvc}
}

func (h *SettingsHandler) GetSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")
	settings, err := h.auth.Settings().GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if dir, ok := req["quadlet_dir"].(string); ok && dir != "" {
		if err := validateQuadletDir(dir); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quadlet_dir: " + err.Error()})
			return
		}
	}
	if err := h.auth.Settings().Update(userID, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func validateQuadletDir(path string) error {
	if !filepath.IsAbs(path) {
		return errors.New("must be absolute path")
	}
	clean := filepath.Clean(path)
	forbidden := []string{"/", "/bin", "/sbin", "/usr", "/etc", "/boot", "/sys", "/proc", "/dev", "/root"}
	for _, f := range forbidden {
		if clean == f {
			return errors.New("system directory not allowed")
		}
	}
	info, err := os.Stat(clean)
	if err != nil {
		return errors.New("directory does not exist")
	}
	if !info.IsDir() {
		return errors.New("not a directory")
	}
	return nil
}
