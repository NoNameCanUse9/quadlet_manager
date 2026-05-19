# GitHub Release OTA Update Check — Design Spec

> Quadlet Manager 基于 GitHub Release 的版本检查与通知系统。

---

## 1. Overview

Quadlet Manager 是一个长驻服务，以单个 Go 二进制运行（内嵌前端 SPA）。本功能为其添加：

- **版本号系统**：通过 git tag + ldflags 在构建时注入版本号
- **自动检查更新**：后端定期查询 GitHub Releases API
- **前端通知**：AppHeader 小红点 + Settings 页面详细信息
- **CI/CD**：GitHub Actions 自动构建多平台二进制并发布 Release

用户手动下载新版本替换二进制，不实现自动替换。

---

## 2. Version System

### 2.1 版本注入

新增 `internal/version/version.go`：

```go
package version

// Version is set at build time via ldflags.
// Default "dev" indicates a development build.
var Version = "dev"
```

Makefile 修改：

```makefile
VERSION := $(shell git describe --tags --always --dirty)

build: frontend
    mkdir -p cmd/quadlet-manager/web
    cp -r web/dist cmd/quadlet-manager/web/
    go build -ldflags "-s -w -X github.com/choken/quadlet-manager/internal/version.Version=$(VERSION)" \
        -o bin/quadlet-manager ./cmd/quadlet-manager
    rm -rf cmd/quadlet-manager/web
```

### 2.2 API 暴露

`GET /api/v1/system/info` 响应新增 `version` 字段：

```json
{
  "port": 8080,
  "rootless": true,
  "quadletDir": "/home/user/.config/containers/systemd",
  "version": "v1.2.3"
}
```

变更文件：`internal/handler/system_handler.go` 的 `SystemInfo` struct。

---

## 3. Update Checker (Backend)

### 3.1 新增包

`internal/updater/checker.go`

### 3.2 数据模型

```go
type UpdateInfo struct {
    Current     string `json:"current"`      // 当前版本 (e.g. "v1.2.3")
    Latest      string `json:"latest"`       // GitHub 最新 release tag
    HasUpdate   bool   `json:"hasUpdate"`    // semver(latest) > semver(current)
    ReleaseURL  string `json:"releaseUrl"`   // "https://github.com/choken/quadlet-manager/releases/tag/v1.3.0"
    ReleaseNote string `json:"releaseNote"`  // Release body (markdown)
    PublishedAt string `json:"publishedAt"`  // ISO8601
    CheckedAt   string `json:"checkedAt"`    // ISO8601, 上次检查时间
}
```

### 3.3 Checker 核心逻辑

```go
type Checker struct {
    currentVersion string
    githubRepo     string        // "choken/quadlet-manager"
    mu             sync.RWMutex
    cached         *UpdateInfo
    checkInterval  time.Duration // default 24h
    httpClient     *http.Client
}

func NewChecker(currentVersion, githubRepo string) *Checker
func (c *Checker) Check(ctx context.Context) (*UpdateInfo, error)  // 调用 GitHub API
func (c *Checker) GetCached() *UpdateInfo                          // 返回缓存结果
func (c *Checker) StartPeriodicCheck(ctx context.Context)          // 启动后台 goroutine
```

**GitHub API 调用**：
- Endpoint: `https://api.github.com/repos/{owner}/{repo}/releases/latest`
- 无需认证（rate limit 60/h，24h 轮询一次完全够用）
- User-Agent: `quadlet-manager/{version}`

**版本比较**：
- 使用 `golang.org/x/mod/semver` 进行语义化版本比较
- 如果当前版本是 `dev`（开发构建），始终返回 `HasUpdate = true`
- 如果当前版本或最新版本不是合法 semver（如 `v1.2.3-5-gabcdef`），回退到字符串不等比较：版本不同即认为有更新
- tag 格式不含 `v` 前缀时自动补上（`semver.IsValid` 要求 `v` 前缀）

**错误处理**：
- 网络不可达：静默失败，`HasUpdate = false`，log 一条 warning
- GitHub API 403 (rate limited)：静默失败
- JSON 解析错误：静默失败

### 3.4 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/system/update` | 获取缓存的更新信息 |
| POST | `/api/v1/system/update/check` | 手动触发一次检查 |

均需 JWT 认证。

### 3.5 集成到 main.go

```go
// 在 main.go 中
updateChecker := updater.NewChecker(version.Version, "choken/quadlet-manager")
updateChecker.StartPeriodicCheck(context.Background())

// 注册路由
protected.GET("/system/update", systemH.GetUpdateInfo)
protected.POST("/system/update/check", systemH.CheckUpdate)
```

---

## 4. Frontend

### 4.1 API 客户端

`web/src/api/client.ts` 新增：

```typescript
getUpdateInfo: () => request<UpdateInfo>('/system/update'),
checkUpdate: () => request<UpdateInfo>('/system/update/check', { method: 'POST' }),
```

新增 `UpdateInfo` 接口定义。

### 4.2 AppHeader 通知

在语言切换按钮左侧增加更新通知：

- **无更新**：不显示任何内容
- **有更新**：显示蓝色 `ArrowUpCircle` 图标 + 小圆点 badge
- **点击**：弹出 Popover，显示当前版本 → 最新版本 + "前往下载" 按钮

使用 TanStack Query `useQuery` 定期轮询 `/api/v1/system/update`（每 30 分钟）。

### 4.3 Settings 页面

在 Settings 页面底部增加 "关于" 区块：

```
┌─────────────────────────────────┐
│ 关于                            │
│ 当前版本: v1.2.3                │
│ 最新版本: v1.3.0 (有更新)       │
│ 上次检查: 2026-05-20 14:30      │
│                                 │
│ [检查更新]  [前往下载]           │
│                                 │
│ Release Notes:                  │
│ - feat: add OTA update check    │
│ - fix: container log tail       │
└─────────────────────────────────┘
```

### 4.4 i18n

新增翻译 key：
- `settings.about` / `settings.about.title`
- `settings.about.currentVersion` / `settings.about.latestVersion`
- `settings.about.hasUpdate` / `settings.about.noUpdate`
- `settings.about.checkUpdate` / `settings.about.goToDownload`
- `settings.about.lastChecked` / `settings.about.releaseNotes`
- `header.updateAvailable`

---

## 5. GitHub Actions CI/CD

### 5.1 Release Workflow

文件：`.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - goos: linux
            goarch: amd64
          - goos: linux
            goarch: arm64
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd web && npm ci && npm run build
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - name: Build
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          mkdir -p cmd/quadlet-manager/web
          cp -r web/dist cmd/quadlet-manager/web/
          go build -ldflags "-s -w -X github.com/choken/quadlet-manager/internal/version.Version=$VERSION" \
            -o quadlet-manager-${{ matrix.goos }}-${{ matrix.goarch }} ./cmd/quadlet-manager
      - uses: actions/upload-artifact@v4
        with:
          name: quadlet-manager-${{ matrix.goos }}-${{ matrix.goarch }}
          path: quadlet-manager-*

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with: { path: artifacts }
      - name: Checksums
        run: |
          cd artifacts
          sha256sum */* > ../checksums.txt
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/*/*
            checksums.txt
          generate_release_notes: true
```

### 5.2 CI Workflow

文件：`.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: go test ./internal/...

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd web && npm ci && npm run build
```

---

## 6. File Changes Summary

### New files
| File | Purpose |
|------|---------|
| `internal/version/version.go` | Version variable (ldflags target) |
| `internal/updater/checker.go` | GitHub Release checker |
| `internal/updater/checker_test.go` | Checker tests |
| `.github/workflows/release.yml` | Release CI/CD |
| `.github/workflows/ci.yml` | PR/push CI |

### Modified files
| File | Change |
|------|--------|
| `Makefile` | Add ldflags version injection |
| `internal/handler/system_handler.go` | Add `version` to SystemInfo, add update endpoints |
| `cmd/quadlet-manager/main.go` | Initialize Checker, register update routes |
| `web/src/api/client.ts` | Add UpdateInfo type + API methods |
| `web/src/components/layout/AppHeader.tsx` | Add update notification badge |
| `web/src/pages/SettingsPage.tsx` | Add "About" section |
| `web/src/i18n/en.json` | Add update-related translations |
| `web/src/i18n/zh.json` | Add update-related translations |

---

## 7. Dependencies

### Go
- `golang.org/x/mod/semver` — 语义化版本比较
- `net/http` (stdlib) — GitHub API 调用

### Frontend
- 无新依赖，使用现有的 TanStack Query + shadcn/ui

---

## 8. Testing Strategy

| Component | Test Type | Approach |
|-----------|-----------|----------|
| `version.go` | N/A | 纯变量，无需测试 |
| `updater.Checker` | Unit test | Mock HTTP server 返回模拟 GitHub API 响应 |
| `SystemHandler` | Unit test | 已有 handler 测试模式，新增 update 端点测试 |
| 前端 | Manual | AppHeader badge + Settings 页面功能验证 |

---

## 9. Out of Scope

- 自动下载并替换二进制（用户手动更新）
- macOS / Windows 平台构建（仅 Linux amd64/arm64）
- GitHub token 认证（使用未认证 API，rate limit 足够）
- 数据库迁移（不涉及）
