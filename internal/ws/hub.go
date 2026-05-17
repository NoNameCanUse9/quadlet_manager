package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- msg:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: marshal error: %v", err)
		return
	}
	h.broadcast <- data
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws: upgrade error: %v", err)
		return
	}

	client := &Client{conn: conn, send: make(chan []byte, 256)}
	h.register <- client

	go client.writePump()
	go client.readPump(h)
}

func (c *Client) readPump(h *Hub) {
	defer func() {
		h.unregister <- c
		c.conn.Close()
	}()
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}

// ClientCount returns the number of connected WebSocket clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// StatsSource is a function that returns current container stats.
type StatsSource func(ctx context.Context) (interface{}, error)

// StartStatsBroadcaster periodically fetches stats and broadcasts to all clients.
func (h *Hub) StartStatsBroadcaster(ctx context.Context, interval time.Duration, source StatsSource) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if h.ClientCount() == 0 {
					continue
				}
				stats, err := source(ctx)
				if err != nil {
					continue
				}
				h.Broadcast(Message{Type: "stats_update", Data: stats})
			}
		}
	}()
}

// UnitStatus represents a unit's current state for alert monitoring.
type UnitStatus struct {
	Name        string `json:"name"`
	ActiveState string `json:"activeState"`
}

// UnitListSource is a function that returns current unit statuses.
type UnitListSource func(ctx context.Context) ([]UnitStatus, error)

// StartAlertBroadcaster polls unit statuses and broadcasts unit_failed events.
func (h *Hub) StartAlertBroadcaster(ctx context.Context, interval time.Duration, source UnitListSource) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		previousFailed := make(map[string]bool)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if h.ClientCount() == 0 {
					continue
				}
				units, err := source(ctx)
				if err != nil {
					continue
				}
				currentFailed := make(map[string]bool)
				for _, u := range units {
					if u.ActiveState == "failed" {
						currentFailed[u.Name] = true
						if !previousFailed[u.Name] {
							h.Broadcast(Message{
								Type: "unit_failed",
								Data: map[string]string{"name": u.Name},
							})
						}
					}
				}
				previousFailed = currentFailed
			}
		}
	}()
}
