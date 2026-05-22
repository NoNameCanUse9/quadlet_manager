package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
