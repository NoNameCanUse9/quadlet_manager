package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCompareVersions_DevAlwaysHasUpdate(t *testing.T) {
	info := &UpdateInfo{Current: "dev", Latest: "v1.0.0"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("dev version should always have update")
	}
}

func TestCompareVersions_SemverNewer(t *testing.T) {
	info := &UpdateInfo{Current: "v1.0.0", Latest: "v1.1.0"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("v1.1.0 > v1.0.0 should have update")
	}
}

func TestCompareVersions_SemverSame(t *testing.T) {
	info := &UpdateInfo{Current: "v1.0.0", Latest: "v1.0.0"}
	compareVersions(info)
	if info.HasUpdate {
		t.Error("same version should not have update")
	}
}

func TestCompareVersions_SemverOlder(t *testing.T) {
	info := &UpdateInfo{Current: "v2.0.0", Latest: "v1.0.0"}
	compareVersions(info)
	if info.HasUpdate {
		t.Error("current newer than latest should not have update")
	}
}

func TestCompareVersions_InvalidSemver_Fallback(t *testing.T) {
	info := &UpdateInfo{Current: "abc", Latest: "def"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("different non-semver strings should have update")
	}
	info2 := &UpdateInfo{Current: "abc", Latest: "abc"}
	compareVersions(info2)
	if info2.HasUpdate {
		t.Error("same non-semver strings should not have update")
	}
}

func TestCompareVersions_DirtyGitDescribe(t *testing.T) {
	info := &UpdateInfo{Current: "v1.2.3-5-gabcdef", Latest: "v1.2.3"}
	compareVersions(info)
	if !info.HasUpdate {
		t.Error("dirty git describe vs release should have update")
	}
}

func TestChecker_Check_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/test/repo/releases/latest" {
			w.WriteHeader(404)
			return
		}
		json.NewEncoder(w).Encode(githubRelease{
			TagName:     "v1.2.0",
			HTMLURL:     "https://github.com/test/repo/releases/tag/v1.2.0",
			Body:        "## Changes\n- new feature",
			PublishedAt: "2026-05-20T10:00:00Z",
		})
	}))
	defer srv.Close()

	c := &Checker{
		currentVersion: "v1.0.0",
		githubRepo:     "test/repo",
		checkInterval:  24 * time.Hour,
		httpClient:     srv.Client(),
		baseURL:        srv.URL + "/repos",
	}

	info, err := c.Check(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.HasUpdate {
		t.Error("expected HasUpdate=true")
	}
	if info.Latest != "v1.2.0" {
		t.Errorf("expected latest v1.2.0, got %s", info.Latest)
	}
	if info.Current != "v1.0.0" {
		t.Errorf("expected current v1.0.0, got %s", info.Current)
	}
}

func TestChecker_Check_NetworkError(t *testing.T) {
	c := &Checker{
		currentVersion: "v1.0.0",
		githubRepo:     "test/repo",
		checkInterval:  24 * time.Hour,
		httpClient:     &http.Client{Transport: &badTransport{}},
		baseURL:        "http://invalid.invalid/repos",
	}

	info, err := c.Check(context.Background())
	if err == nil {
		t.Error("expected error for network failure")
	}
	if info != nil {
		t.Error("expected nil info on error")
	}
}

func TestChecker_GetCached(t *testing.T) {
	c := NewChecker("v1.0.0", "test/repo")
	if c.GetCached() != nil {
		t.Error("expected nil cached before first check")
	}
}

type badTransport struct{}

func (t *badTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, &net.OpError{Err: fmt.Errorf("simulated network error")}
}
