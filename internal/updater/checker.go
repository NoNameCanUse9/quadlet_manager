package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"golang.org/x/mod/semver"
)

// UpdateInfo holds the result of an update check.
type UpdateInfo struct {
	Current     string `json:"current"`
	Latest      string `json:"latest"`
	HasUpdate   bool   `json:"hasUpdate"`
	ReleaseURL  string `json:"releaseUrl"`
	DownloadURL string `json:"downloadUrl"`
	ReleaseNote string `json:"releaseNote"`
	PublishedAt string `json:"publishedAt"`
	CheckedAt   string `json:"checkedAt"`
}

// githubRelease is the GitHub API response subset we need.
type githubRelease struct {
	TagName     string          `json:"tag_name"`
	HTMLURL     string          `json:"html_url"`
	Body        string          `json:"body"`
	PublishedAt string          `json:"published_at"`
	Assets      []githubAsset   `json:"assets"`
}

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// Checker periodically checks GitHub for new releases.
type Checker struct {
	currentVersion string
	githubRepo     string
	token          string // optional GitHub token for higher rate limits
	mu             sync.RWMutex
	cached         *UpdateInfo
	checkInterval  time.Duration
	httpClient     *http.Client
	baseURL        string // overridable for testing
}

// NewChecker creates a new update checker.
// githubRepo is "owner/repo" (e.g. "choken/quadlet-manager").
// token is an optional GitHub personal access token.
func NewChecker(currentVersion, githubRepo, token string) *Checker {
	return &Checker{
		currentVersion: currentVersion,
		githubRepo:     githubRepo,
		token:          token,
		checkInterval:  24 * time.Hour,
		httpClient:     &http.Client{Timeout: 10 * time.Second},
		baseURL:        "https://api.github.com/repos",
	}
}

// Check calls GitHub API and returns update info.
func (c *Checker) Check(ctx context.Context) (*UpdateInfo, error) {
	url := fmt.Sprintf("%s/%s/releases/latest", c.baseURL, c.githubRepo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "quadlet-manager/"+c.currentVersion)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("github api rate limited (status %d), will retry later", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api status %d", resp.StatusCode)
	}

	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	info := &UpdateInfo{
		Current:     c.currentVersion,
		Latest:      rel.TagName,
		ReleaseURL:  rel.HTMLURL,
		DownloadURL: findDownloadURL(rel.Assets),
		ReleaseNote: rel.Body,
		PublishedAt: rel.PublishedAt,
		CheckedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	compareVersions(info)

	c.mu.Lock()
	c.cached = info
	c.mu.Unlock()

	return info, nil
}

// findDownloadURL finds the binary download URL matching the current OS and architecture.
func findDownloadURL(assets []githubAsset) string {
	suffix := fmt.Sprintf("-%s-%s", runtime.GOOS, runtime.GOARCH)
	for _, a := range assets {
		if strings.HasSuffix(a.Name, suffix) {
			return a.BrowserDownloadURL
		}
	}
	return ""
}

// GetCached returns the last check result, or nil if never checked.
func (c *Checker) GetCached() *UpdateInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cached
}

// StartPeriodicCheck starts a background goroutine that checks every checkInterval.
func (c *Checker) StartPeriodicCheck(ctx context.Context) {
	go func() {
		// Initial check on startup
		if _, err := c.Check(ctx); err != nil {
			log.Printf("updater: check deferred: %v", err)
		}
		ticker := new(time.Ticker)
		*ticker = *time.NewTicker(c.checkInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := c.Check(ctx); err != nil {
					log.Printf("updater: check deferred: %v", err)
				}
			}
		}
	}()
}

// SelfUpdate downloads the latest binary, verifies checksum, and replaces the current executable.
func (c *Checker) SelfUpdate(ctx context.Context) error {
	info := c.GetCached()
	if info == nil || !info.HasUpdate || info.DownloadURL == "" {
		return fmt.Errorf("no update available or download URL missing")
	}

	// Get current executable path
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get executable path: %w", err)
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return fmt.Errorf("resolve symlink: %w", err)
	}

	// Download new binary
	binData, err := c.download(ctx, info.DownloadURL)
	if err != nil {
		return fmt.Errorf("download binary: %w", err)
	}

	// Download and verify checksum
	checksumURL := strings.TrimSuffix(info.DownloadURL, filepath.Base(info.DownloadURL)) + "checksums.txt"
	checksumData, err := c.download(ctx, checksumURL)
	if err == nil {
		expectedHash := parseChecksum(checksumData, filepath.Base(info.DownloadURL))
		if expectedHash != "" {
			actualHash := sha256Hex(binData)
			if actualHash != expectedHash {
				return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHash, actualHash)
			}
		}
	}
	// Checksum verification is optional — proceed if checksums.txt not found

	// Write to temp file in same directory
	dir := filepath.Dir(exePath)
	tmpFile, err := os.CreateTemp(dir, ".quadlet-manager-update-*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath) // cleanup on failure

	if _, err := tmpFile.Write(binData); err != nil {
		tmpFile.Close()
		return fmt.Errorf("write temp file: %w", err)
	}
	tmpFile.Close()

	// Match permissions of current binary
	if info, err := os.Stat(exePath); err == nil {
		os.Chmod(tmpPath, info.Mode())
	}

	// Atomic rename
	if err := os.Rename(tmpPath, exePath); err != nil {
		return fmt.Errorf("replace binary: %w", err)
	}

	log.Printf("updater: self-update to %s complete", info.Latest)
	return nil
}

func (c *Checker) download(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func parseChecksum(checksumData []byte, filename string) string {
	for _, line := range strings.Split(string(checksumData), "\n") {
		parts := strings.Fields(line)
		if len(parts) == 2 && parts[1] == filename {
			return parts[0]
		}
	}
	return ""
}

// compareVersions sets HasUpdate based on semver comparison.
// Falls back to string inequality for non-semver versions.
func compareVersions(info *UpdateInfo) {
	current := ensureV(info.Current)
	latest := ensureV(info.Latest)

	if info.Current == "dev" {
		info.HasUpdate = true
		return
	}

	if semver.IsValid(current) && semver.IsValid(latest) {
		info.HasUpdate = semver.Compare(latest, current) > 0
		return
	}

	// Fallback: different string = has update
	info.HasUpdate = current != latest
}

// ensureV adds "v" prefix if missing (required by semver.IsValid).
func ensureV(v string) string {
	if len(v) > 0 && v[0] != 'v' {
		return "v" + v
	}
	return v
}
