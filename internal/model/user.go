package model

import "time"

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type UserSettings struct {
	UserID               int64  `json:"userId"`
	Language             string `json:"language"`
	Theme                string `json:"theme"`
	QuadletDir           string `json:"quadletDir"`
	PodmanSocket         string `json:"podmanSocket"`
	ItemsPerPage         int    `json:"itemsPerPage"`
	AutoRefreshSeconds   int    `json:"autoRefreshSeconds"`
	DefaultRestartPolicy string `json:"defaultRestartPolicy"`
	NotifyOnFailure      bool   `json:"notifyOnFailure"`
}
