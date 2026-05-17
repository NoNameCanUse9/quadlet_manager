package model

import "time"

type QuadletFile struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Content string    `json:"content"`
	ModTime time.Time `json:"modTime"`
	Type    string    `json:"type"` // "container", "volume", "network", "pod", "kube", "image"
}
