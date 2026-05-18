package model

type ComposeProject struct {
	Name     string   `json:"name"`
	File     string   `json:"file"`
	Status   string   `json:"status"`
	Services []string `json:"services"`
}

type ComposeService struct {
	Name  string `json:"name"`
	State string `json:"state"`
	Image string `json:"image"`
	Ports string `json:"ports"`
}

type QuadletConversion struct {
	Filename string   `json:"filename"`
	Content  string   `json:"content"`
	Warnings []string `json:"warnings"`
}
