package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var execUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "" || origin == "http://localhost:9090" || origin == "http://localhost:8080"
	},
}

type ExecHandler struct {
	podman    provider.PodmanProvider
	jwtSecret []byte
}

func NewExecHandler(podman provider.PodmanProvider) *ExecHandler {
	return &ExecHandler{podman: podman}
}

func (h *ExecHandler) SetJWTSecret(secret []byte) {
	h.jwtSecret = secret
}

// ExecCreate creates a new exec session and returns the exec_id.
func (h *ExecHandler) ExecCreate(c *gin.Context) {
	containerID := c.Param("id")
	var req struct {
		Cmd []string `json:"cmd"`
	}
	if err := c.BindJSON(&req); err != nil || len(req.Cmd) == 0 {
		req.Cmd = []string{"/bin/sh"}
	}

	execID, err := h.podman.ExecCreate(c.Request.Context(), containerID, req.Cmd, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exec_id": execID})
}

// ExecWebSocket upgrades to WebSocket and bridges to the Podman exec session.
func (h *ExecHandler) ExecWebSocket(c *gin.Context) {
	execID := c.Param("exec_id")

	// Validate JWT from query param
	if len(h.jwtSecret) > 0 {
		token := c.Query("token")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		if _, err := auth.ValidateToken(h.jwtSecret, token); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
	}

	wsConn, err := execUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("exec ws upgrade: %v", err)
		return
	}
	defer wsConn.Close()

	podmanConn, err := h.podman.ExecAttach(c.Request.Context(), execID)
	if err != nil {
		wsConn.WriteMessage(websocket.TextMessage, []byte("exec attach failed: "+err.Error()))
		return
	}
	defer podmanConn.Close()

	done := make(chan struct{}, 2)

	// WebSocket → Podman (user input + resize)
	go func() {
		defer func() { done <- struct{}{} }()
		for {
			msgType, msg, err := wsConn.ReadMessage()
			if err != nil {
				return
			}
			if msgType == websocket.TextMessage && isResizeMessage(msg) {
				cols, rows := parseResize(msg)
				h.podman.ExecResize(c.Request.Context(), execID, rows, cols)
				continue
			}
			podmanConn.Write(msg)
		}
	}()

	// Podman → WebSocket (terminal output)
	go func() {
		defer func() { done <- struct{}{} }()
		buf := make([]byte, 32*1024)
		for {
			n, err := podmanConn.Read(buf)
			if err != nil {
				return
			}
			if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				return
			}
		}
	}()

	<-done
}

func isResizeMessage(msg []byte) bool {
	return len(msg) > 0 && msg[0] == '{' && strings.Contains(string(msg), `"type":"resize"`)
}

func parseResize(msg []byte) (cols, rows uint) {
	var r struct {
		Type string `json:"type"`
		Cols uint   `json:"cols"`
		Rows uint   `json:"rows"`
	}
	json.Unmarshal(msg, &r)
	return r.Cols, r.Rows
}
