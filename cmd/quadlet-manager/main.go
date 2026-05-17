package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/handler"
	"github.com/choken/quadlet-manager/internal/middleware"
	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

//go:embed all:web/dist
var webDist embed.FS

func main() {
	port := flag.Int("port", 0, "Server port (default: 8080)")
	rootless := flag.Bool("rootless", false, "Force rootless mode")
	quadletDir := flag.String("quadlet-dir", "", "Override Quadlet scan directory")
	podmanSocket := flag.String("podman-socket", "", "Override Podman socket path")
	devMode := flag.Bool("dev", false, "Enable dev mode (proxy to Vite)")
	flag.Parse()

	var rootlessPtr *bool
	if flagWasSet("rootless") {
		rootlessPtr = rootless
	}

	cfg := config.New(config.Options{
		Port:         *port,
		Rootless:     rootlessPtr,
		QuadletDir:   *quadletDir,
		PodmanSocket: *podmanSocket,
		DevMode:      *devMode,
	})

	if err := cfg.Validate(); err != nil {
		log.Fatalf("config: %v", err)
	}

	// Initialize providers
	systemdProvider := newSystemdProvider(cfg)
	podmanProvider := provider.NewSocketPodmanProvider(cfg.PodmanSocket)
	quadletFS := provider.NewQuadletFSImpl(cfg.QuadletDir)

	// Initialize services
	unitSvc := service.NewUnitService(systemdProvider, quadletFS)
	containerSvc := service.NewContainerService(podmanProvider)
	fileSvc := service.NewFileService(quadletFS, systemdProvider)

	// Initialize WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Start stats broadcaster (every 5 seconds)
	hub.StartStatsBroadcaster(context.Background(), 5*time.Second, func(ctx context.Context) (interface{}, error) {
		return containerSvc.GetAllStats(ctx)
	})

	// Initialize handlers
	systemH := handler.NewSystemHandler(cfg, unitSvc)
	unitH := handler.NewUnitHandler(unitSvc, hub)
	fileH := handler.NewFileHandler(fileSvc)
	containerH := handler.NewContainerHandler(containerSvc)
	statsH := handler.NewStatsHandler(containerSvc, hub)

	// Setup router
	r := gin.Default()
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	api := r.Group("/api/v1")
	{
		api.GET("/system/info", systemH.GetSystemInfo)

		api.GET("/units", unitH.ListUnits)
		api.GET("/units/:name", unitH.GetUnit)
		api.POST("/units/:name/start", unitH.StartUnit)
		api.POST("/units/:name/stop", unitH.StopUnit)
		api.POST("/units/:name/restart", unitH.RestartUnit)
		api.POST("/units/:name/enable", unitH.EnableUnit)
		api.POST("/units/:name/disable", unitH.DisableUnit)
		api.POST("/daemon/reload", unitH.DaemonReload)

		api.GET("/files", fileH.ListFiles)
		api.GET("/files/:filename", fileH.ReadFile)
		api.POST("/files", fileH.CreateFile)
		api.PUT("/files/:filename", fileH.UpdateFile)
		api.DELETE("/files/:filename", fileH.DeleteFile)
		api.POST("/files/:filename/apply", fileH.ApplyFile)
		api.POST("/files/validate", fileH.ValidateFile)

		api.GET("/containers", containerH.ListContainers)
		api.GET("/containers/:id/logs", containerH.GetContainerLogs)
		api.GET("/containers/images", containerH.ListImages)
		api.GET("/containers/volumes", containerH.ListVolumes)
		api.GET("/containers/networks", containerH.ListNetworks)

		api.GET("/stats", statsH.GetStats)
	}

	r.GET("/ws", statsH.HandleWebSocket)

	// Serve embedded frontend (SPA fallback)
	if !cfg.DevMode {
		staticFS, _ := fs.Sub(webDist, "web/dist")
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			// Try to serve static file
			if f, err := staticFS.Open(strings.TrimPrefix(path, "/")); err == nil {
				f.Close()
				http.FileServer(http.FS(staticFS)).ServeHTTP(c.Writer, c.Request)
				return
			}
			// SPA fallback: serve index.html
			c.FileFromFS("/", http.FS(staticFS))
		})
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("quadlet-manager listening on %s (rootless=%v, dev=%v)", addr, cfg.Rootless, cfg.DevMode)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func flagWasSet(name string) bool {
	found := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == name {
			found = true
		}
	})
	return found
}

// newSystemdProvider tries the real D-Bus provider, falls back to mock.
func newSystemdProvider(cfg config.Config) provider.SystemdProvider {
	dbus := provider.NewDBusSystemdProvider(cfg.Rootless)
	if err := dbus.Connect(context.Background()); err != nil {
		log.Printf("D-Bus unavailable (%v), using mock systemd provider", err)
		return provider.NewMockSystemd(cfg.Rootless)
	}
	log.Printf("Connected to systemd D-Bus (rootless=%v)", cfg.Rootless)
	return dbus
}
