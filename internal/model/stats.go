package model

type SystemStats struct {
	Containers []ContainerStats `json:"containers"`
}
