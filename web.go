package web

import "embed"

//go:embed all:web/dist
var WebDist embed.FS
