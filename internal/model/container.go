package model

type ContainerInfo struct {
	ID     string   `json:"id"`
	Names  []string `json:"names"`
	Image  string   `json:"image"`
	State  string   `json:"state"`
	Status string   `json:"status"`
}

type ContainerStats struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpuPercent"`
	MemUsage   uint64  `json:"memUsage"`
	MemLimit   uint64  `json:"memLimit"`
	NetInput   uint64  `json:"netInput"`
	NetOutput  uint64  `json:"netOutput"`
}

type ImageInfo struct {
	ID   string   `json:"id"`
	Tags []string `json:"tags"`
	Size int64    `json:"size"`
}

type VolumeInfo struct {
	Name       string `json:"name"`
	MountPoint string `json:"mountPoint"`
}

type NetworkInfo struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}

// ContainerInspect holds detailed container info from Podman inspect.
type ContainerInspect struct {
	ID     string            `json:"Id"`
	Name   string            `json:"Name"`
	State  *ContainerState   `json:"State"`
	Labels map[string]string `json:"Labels"`
	Config *ContainerConfig  `json:"Config"`
}

type ContainerState struct {
	Status     string `json:"Status"`
	Running    bool   `json:"Running"`
	Paused     bool   `json:"Paused"`
	Restarting bool   `json:"Restarting"`
	OOMKilled  bool   `json:"OomKilled"`
	Dead       bool   `json:"Dead"`
	Pid        int    `json:"Pid"`
	ExitCode   int    `json:"ExitCode"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

type ContainerConfig struct {
	Image  string            `json:"Image"`
	Cmd    []string          `json:"Cmd"`
	Env    []string          `json:"Env"`
	Labels map[string]string `json:"Labels"`
}
