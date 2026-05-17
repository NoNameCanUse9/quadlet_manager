package handler

import (
	"net/http"
	"strconv"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/choken/quadlet-manager/internal/model"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	auth *auth.Service
}

func NewAuthHandler(authSvc *auth.Service) *AuthHandler {
	return &AuthHandler{auth: authSvc}
}

func (h *AuthHandler) CheckInit(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"initialized": h.auth.HasAdmin()})
}

func (h *AuthHandler) InitAdmin(c *gin.Context) {
	if h.auth.HasAdmin() {
		c.JSON(http.StatusConflict, gin.H{"error": "already initialized"})
		return
	}
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.auth.Register(req.Username, req.Password, "admin"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	token, user, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token, user, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt64("user_id")
	user, err := h.auth.Users().GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	settings, _ := h.auth.Settings().GetByUserID(userID)
	c.JSON(http.StatusOK, gin.H{"user": user, "settings": settings})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}
	if req.Role != "admin" && req.Role != "user" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
		return
	}
	if err := h.auth.Register(req.Username, req.Password, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "created"})
}

func (h *AuthHandler) ListUsers(c *gin.Context) {
	users, err := h.auth.Users().ListAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *AuthHandler) DeleteUser(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.auth.Users().Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *AuthHandler) UpdateUser(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Role     *string `json:"role"`
		Password *string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role != nil {
		if *req.Role != "admin" && *req.Role != "user" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
			return
		}
		h.auth.Users().UpdateRole(id, *req.Role)
	}
	if req.Password != nil {
		hash, _ := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		h.auth.Users().UpdatePassword(id, string(hash))
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// ensure model import is used
var _ = model.User{}
