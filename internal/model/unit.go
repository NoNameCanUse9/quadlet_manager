package model

type UnitStatus struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	LoadState   string `json:"loadState"`
	ActiveState string `json:"activeState"`
	SubState    string `json:"subState"`
	SourcePath  string `json:"sourcePath"`
}

type UnitChangeEvent struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}
