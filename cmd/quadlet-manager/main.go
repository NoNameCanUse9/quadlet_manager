package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	web "github.com/choken/quadlet-manager"
	"github.com/choken/quadlet-manager/internal/auth"
	"github.com/choken/quadlet-manager/internal/config"
	"github.com/choken/quadlet-manager/internal/handler"
	"github.com/choken/quadlet-manager/internal/middleware"
	"github.com/choken/quadlet-manager/internal/provider"
	"github.com/choken/quadlet-manager/internal/service"
	"github.com/choken/quadlet-manager/internal/store"
	"github.com/choken/quadlet-manager/internal/ws"
	"github.com/gin-gonic/gin"
)

func main() {
	port := flag.Int("port", 0, "Server port (default: 8080)")
	rootless := flag.Bool("rootless", false, "Force rootless mode")
	quadletDir := flag.String("quadlet-dir", "", "Override Quadlet scan directory")
	podmanSocket := flag.String("podman-socket", "", "Override Podman socket path")
	devMode := flag.Bool("dev", false, "Enable dev mode (proxy to Vite)")
	jwtSecret := flag.String("jwt-secret", "", "JWT secret (auto-generated if empty)")
	dbPath := flag.String("db", "", "SQLite database path")
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

	// Determine DB path
	dbFilePath := *dbPath
	if dbFilePath == "" {
		if cfg.Rootless {
			home, _ := os.UserHomeDir()
			dbFilePath = filepath.Join(home, ".config", "quadlet-manager", "data.db")
		} else {
			dbFilePath = "/var/lib/quadlet-manager/data.db"
		}
	}
	// Ensure directory exists
	os.MkdirAll(filepath.Dir(dbFilePath), 0755)

	// Initialize database
	db, err := store.NewDB(dbFilePath)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Printf("database: %s", dbFilePath)

	// Initialize JWT secret
	secret := []byte(*jwtSecret)
	if len(secret) == 0 {
		// Try to load from DB
		var stored string
		err := db.QueryRow("SELECT value FROM config WHERE key = 'jwt_secret'").Scan(&stored)
		if err != nil {
			// Generate new secret
			secret, err = auth.GenerateSecret()
			if err != nil {
				log.Fatalf("generate jwt secret: %v", err)
			}
			if _, err := db.Exec("INSERT OR REPLACE INTO config (key, value) VALUES ('jwt_secret', ?)", string(secret)); err != nil {
				log.Fatalf("persist jwt secret: %v", err)
			}
			log.Printf("JWT secret generated and stored")
		} else {
			secret = []byte(stored)
			log.Printf("JWT secret loaded from database")
		}
	}

	// Initialize auth service
	authSvc := auth.NewService(db, secret)

	// Initialize providers
	systemdProvider := newSystemdProvider(cfg)
	podmanProvider := newPodmanProvider(cfg)
	quadletFS := provider.NewQuadletFSImpl(cfg.QuadletDir)

	// Initialize services
	settingsStore := authSvc.Settings()
	unitSvc := service.NewUnitService(systemdProvider, quadletFS, settingsStore, cfg.QuadletDir)
	containerSvc := service.NewContainerService(podmanProvider)
	fileSvc := service.NewFileService(quadletFS, systemdProvider, settingsStore, cfg.QuadletDir)
	orchestrator := service.NewContainerOrchestrator(systemdProvider, podmanProvider)
	imageSvc := service.NewImageService(podmanProvider)
	volumeSvc := service.NewVolumeService(podmanProvider)
	networkSvc := service.NewNetworkService(podmanProvider)
	backupSvc := service.NewBackupService(quadletFS, settingsStore)

	// Initialize WebSocket hub
	hub := ws.NewHub()
	hub.SetJWTSecret(secret)
	go hub.Run()

	// Start stats broadcaster (every 5 seconds)
	hub.StartStatsBroadcaster(context.Background(), 5*time.Second, func(ctx context.Context) (interface{}, error) {
		return containerSvc.GetAllStats(ctx)
	})

	// Start alert broadcaster (every 5 seconds) — detects failed units
	hub.StartAlertBroadcaster(context.Background(), 5*time.Second, func(ctx context.Context) ([]ws.UnitStatus, error) {
		units, err := unitSvc.ListUnits(ctx, 0)
		if err != nil {
			return nil, err
		}
		result := make([]ws.UnitStatus, len(units))
		for i, u := range units {
			result[i] = ws.UnitStatus{Name: u.Name, ActiveState: u.ActiveState}
		}
		return result, nil
	})

	// Initialize handlers
	systemH := handler.NewSystemHandler(cfg, unitSvc)
	unitH := handler.NewUnitHandler(unitSvc, hub)
	fileH := handler.NewFileHandler(fileSvc)
	containerH := handler.NewContainerHandler(containerSvc, orchestrator)
	imageH := handler.NewImageHandler(imageSvc, hub)
	volumeH := handler.NewVolumeHandler(volumeSvc)
	networkH := handler.NewNetworkHandler(networkSvc)
	execH := handler.NewExecHandler(podmanProvider)
	execH.SetJWTSecret(secret)
	backupH := handler.NewBackupHandler(backupSvc)
	statsH := handler.NewStatsHandler(containerSvc, hub)
	authH := handler.NewAuthHandler(authSvc)
	settingsH := handler.NewSettingsHandler(authSvc)

	// Setup router
	r := gin.Default()
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	// Public auth routes (no JWT required)
	authGroup := r.Group("/api/v1/auth")
	{
		authGroup.GET("/init", authH.CheckInit)
		authGroup.POST("/init", authH.InitAdmin)
		authGroup.POST("/login", authH.Login)
	}

	// Protected routes (JWT required)
	protected := r.Group("/api/v1")
	protected.Use(middleware.JWTAuth(secret))
	{
		// Auth (authenticated)
		protected.GET("/auth/me", authH.Me)
		protected.GET("/settings", settingsH.GetSettings)
		protected.PUT("/settings", settingsH.UpdateSettings)

		// Admin only
		admin := protected.Group("/auth")
		admin.Use(middleware.RequireRole("admin"))
		{
			admin.POST("/register", authH.Register)
			admin.GET("/users", authH.ListUsers)
			admin.DELETE("/users/:id", authH.DeleteUser)
			admin.PUT("/users/:id", authH.UpdateUser)
		}

		// System/Unit routes
		protected.GET("/system/info", systemH.GetSystemInfo)

		protected.GET("/units", unitH.ListUnits)
		protected.GET("/units/:name", unitH.GetUnit)
		protected.POST("/units/:name/start", unitH.StartUnit)
		protected.POST("/units/:name/stop", unitH.StopUnit)
		protected.POST("/units/:name/restart", unitH.RestartUnit)
		protected.POST("/units/:name/enable", unitH.EnableUnit)
		protected.POST("/units/:name/disable", unitH.DisableUnit)
		protected.POST("/daemon/reload", unitH.DaemonReload)

		// File routes
		protected.GET("/files", fileH.ListFiles)
		protected.GET("/files/:filename", fileH.ReadFile)
		protected.POST("/files", fileH.CreateFile)
		protected.PUT("/files/:filename", fileH.UpdateFile)
		protected.DELETE("/files/:filename", fileH.DeleteFile)
		protected.POST("/files/:filename/apply", fileH.ApplyFile)
		protected.POST("/files/validate", fileH.ValidateFile)

		// Container routes
		protected.GET("/containers", containerH.ListContainers)
		protected.GET("/containers/:id/logs", containerH.GetContainerLogs)
		protected.POST("/containers/:id/start", containerH.StartContainer)
		protected.POST("/containers/:id/stop", containerH.StopContainer)
		protected.POST("/containers/:id/restart", containerH.RestartContainer)
		protected.POST("/containers/:id/pause", containerH.PauseContainer)
		protected.POST("/containers/:id/unpause", containerH.UnpauseContainer)
		protected.DELETE("/containers/:id", containerH.RemoveContainer)
		protected.GET("/containers/:id/inspect", containerH.InspectContainer)

		// Exec
		protected.POST("/containers/:id/exec", execH.ExecCreate)

		// Images
		protected.GET("/images", imageH.ListImages)
		protected.POST("/images/pull", imageH.PullImage)
		protected.DELETE("/images/:id", imageH.RemoveImage)
		protected.GET("/images/:id/inspect", imageH.InspectImage)

		// Volumes
		protected.GET("/volumes", volumeH.ListVolumes)
		protected.POST("/volumes", volumeH.CreateVolume)
		protected.DELETE("/volumes/:name", volumeH.RemoveVolume)
		protected.GET("/volumes/:name/inspect", volumeH.InspectVolume)

		// Networks
		protected.GET("/networks", networkH.ListNetworks)
		protected.POST("/networks", networkH.CreateNetwork)
		protected.DELETE("/networks/:name", networkH.RemoveNetwork)
		protected.GET("/networks/:name/inspect", networkH.InspectNetwork)

		// Backup
		protected.GET("/backup/export", backupH.ExportBackup)
		protected.POST("/backup/import", backupH.ImportBackup)

		// Stats
		protected.GET("/stats", statsH.GetStats)

		// WebSocket (JWT required via query param or header)
		protected.GET("/ws", statsH.HandleWebSocket)
	}

	r.GET("/api/v1/containers/:id/exec/:exec_id/ws", execH.ExecWebSocket)

	// Serve embedded frontend (SPA fallback)
	if !cfg.DevMode {
		staticFS, _ := fs.Sub(web.WebDist, "web/dist")
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			if f, err := staticFS.Open(strings.TrimPrefix(path, "/")); err == nil {
				f.Close()
				http.FileServer(http.FS(staticFS)).ServeHTTP(c.Writer, c.Request)
				return
			}
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

func newPodmanProvider(cfg config.Config) provider.PodmanProvider {
	podman := provider.NewSocketPodmanProvider(cfg.PodmanSocket)
	if err := podman.Connect(context.Background()); err != nil {
		log.Printf("Podman socket unavailable (%v), using mock podman provider", err)
		return provider.NewMockPodman()
	}
	log.Printf("Connected to Podman socket: %s", cfg.PodmanSocket)
	return podman
}

func newSystemdProvider(cfg config.Config) provider.SystemdProvider {
	dbus := provider.NewDBusSystemdProvider(cfg.Rootless)
	if err := dbus.Connect(context.Background()); err != nil {
		log.Printf("D-Bus unavailable (%v), using mock systemd provider", err)
		return provider.NewMockSystemd(cfg.Rootless)
	}
	log.Printf("Connected to systemd D-Bus (rootless=%v)", cfg.Rootless)
	return dbus
}
