# 变更日志

## 2026-05-20 — GitHub Release OTA 更新检查 + CI/CD 自动发布

### `f07a791` feat: add version system with ldflags injection
- 新增 `internal/version/version.go`，定义 `Version` 变量（默认 `"dev"`），构建时通过 ldflags 注入
- `Makefile` 构建命令新增 `-ldflags "-s -w -X .../version.Version=$(VERSION)"`，`VERSION` 由 `git describe --tags --always --dirty` 生成

### `92fd853` feat(updater): add GitHub Release checker with semver comparison
- 新增 `internal/updater/checker.go`：定期调用 GitHub Releases API 检查新版本，使用 `golang.org/x/mod/semver` 进行语义化版本比较
  - `NewChecker(currentVersion, repo)` 创建检查器
  - `Check()` 手动触发检查，`GetCached()` 获取缓存结果
  - `StartPeriodicCheck()` 启动后台 goroutine（每 24 小时）
  - dev 版本始终认为有更新，dirty git describe 做特殊处理
- 新增 `internal/updater/checker_test.go`：9 个测试覆盖 semver 比较、Mock HTTP Server 成功/网络错误、缓存读取

### `e139c83` feat: integrate update checker with API endpoints
- `internal/handler/system_handler.go`：新增 `GetUpdateInfo()` 和 `CheckUpdate()` handler 方法，`SystemInfo` 响应新增 `version` 字段
- `cmd/quadlet-manager/main.go`：初始化 `updater.Checker`，启动定期检查，注册 `/system/update` 和 `/system/update/check` 路由
- `internal/handler/handler_test.go`：新增 update 相关测试用例

### `c5df43f` feat(frontend): add update API client and i18n translations
- `web/src/api/client.ts`：新增 `UpdateInfo` 接口、`getUpdateInfo()` 和 `checkUpdate()` API 方法，`SystemInfo` 接口新增 `version` 字段
- `web/src/i18n/en.json` / `zh.json`：新增 `header.updateAvailable` 和 `settings.about.*` 共 9 个翻译 key

### `1141115` feat(frontend): add update notification badge to AppHeader
- `web/src/components/layout/AppHeader.tsx`：顶部栏新增蓝色通知图标 + 小圆点 badge（有新版本时显示），点击弹出 Popover 显示版本差异和下载链接，30 分钟自动刷新

### `4b37380` feat(frontend): add About section to Settings page with update info
- `web/src/pages/SettingsPage.tsx`：底部新增「关于」区块，显示当前版本、最新版本、上次检查时间、更新日志，支持手动检查更新和跳转下载

### `0e6d9c4` ci: add GitHub Actions for release and CI
- 新增 `.github/workflows/release.yml`：`v*` tag 触发，构建 linux/amd64 + linux/arm64 二进制，创建 Release 并附带 checksums
- 新增 `.github/workflows/ci.yml`：push main / PR 时运行 Go 测试和前端构建

---

## 2026-05-19 — Quadlet 编排中心大一统 + 配置向导功能升级 (HealthCheck / 依赖 / 动画预览) + Docker Compose UI 支持 + 文件后缀选择器

### 新增
- **配置向导功能升级 (HealthCheck / 依赖 / 动画预览)**:
  - **健康检查 (Health Check) 配置**：向导的常规配置面板（GeneralPanel）中新增「健康检查」配置折叠区，支持配置健康检查命令、检查间隔、重试次数、超时时间以及慢启动服务的启动宽限期（Start Period）。
  - **高级生命周期与路径等待**：服务配置面板（ServicePanel）中新增「等待挂载点 (waitForPaths)」配置，配合自动生成 `ExecStartPre` 脚本确保挂载路径可用；同时支持手动配置额外的启动前（ExecStartPre）/启动后（ExecStartPost）执行脚本。
  - **自动更新配置**：向导中新增 `AutoUpdate` 字段，支持设置 `Registry` (自动拉取最新镜像) 或 `Local` (本地检测变更)。
  - **代码预览 Diff 高亮动效**：配置向导表单在实时生成 Quadlet 代码时，会在右侧的代码预览面板（CodePreview）高亮显示发生变动的行，并附带平滑的淡出动效，双向绑定交互更具质感。
  - **i18n 本地化补全**：在 `en.json` 与 `zh.json` 中补全了向导配置卡片、健康检查和依赖脚本等高级选项的全部中英文翻译对照。
- **UI 布局舒适度与一致性优化**:
  - **全局 UI 元素等比放大**：将容器、镜像、卷、网络、用户管理和 Quadlet 编辑页面中的文字、表格行高、输入框、下拉框以及操作控制图标全面等比放大（如表格字体从 `text-xs` 提升至 `text-sm`），提升高分屏下的阅读与点击舒适度。
  - **侧边栏 (AppSidebar) 拓宽与美化**：侧边栏宽度从 `w-56` 提升至 `w-64`，菜单文字升级至 `text-sm`，图标放大至 `size={17}`，新增极光指示条与呼吸灯微动效，底部 rootless 路径框支持一键点击复制。
  - **顶部导航栏 (AppHeader) 像素级对齐**：将顶栏高度和侧边栏品牌区域高度统一调整为 `h-16 (64px)`，实现底部分割线水平方向完美对齐；顶栏控制按钮和文件名 Badge 同步进行了等比放大和美化。
- **Quadlet 编排控制中心大一统**:
  - 将原先独立的 `UnitsPage`（服务控制）与 `FilesPage`（配置编辑）**深度合并**为统一的 **"Quadlet" 编排中心**。
  - 在新建/编辑 Quadlet 文件时，直接在工作区顶部提供实时的 Systemd 服务状态看板（支持运行状态、活动子状态的实时同步）。
  - 集成了完整的 Systemd 单元生命周期管理功能（一键启动、停止、重启、开机自启开关），若文件未部署则提供一键 Deploy 按钮。
  - 精简了侧边栏与路由设计，删除了冗余的 单元服务 菜单项，任何对旧版 `/units` 的访问都会自动 301 重定向至新版 Quadlet 编排中心。
- **Compose 项目 UI 界面 (commit 4c2bd8)**:
  - 新增 `ImportComposeDialog` 弹窗，支持通过输入项目名并粘贴 `docker-compose.yml` 导入 Compose 项目。
  - 新增 `ComposeProjectCard` 卡片组件，展示项目状态及服务列表，并支持 Up (启动)、Down (停止)、Delete (删除) 动作。
  - 新增 `ConvertPreviewDialog` 预览弹窗，展示将 Compose 转换为 Quadlet 文件后的效果，支持多服务 Tab 切换、复制、警告说明。
  - 在 `ContainersPage` 容器页面顶部集成 Compose 项目管理面板。
  - 新增 `useCompose.ts` 的 React TanStack Query Hooks 用于管理 Compose 相关的后端接口调用。
- **新建文件后缀下拉选择框 (commit 0f1c0b)**:
  - 在 `FilesPage` 文件页面的新建文件对话框中，将手动输入完整文件名改为 **文件名输入框 + 后缀下拉选择框** 的组合。
  - 默认选择器选中 `.container`，下拉框包含全部 6 种合法的后缀名：`.container`、`.volume`、`.network`、`.pod` 、`.kube`、`.image`。

- **Compose 导入支持自定义存储目录**:
  - `ImportComposeDialog` 弹窗新增可选的「存储目录」输入框，留空则使用默认 quadletDir。
  - 后端 `ComposeProvider.ImportProject` 接口新增 `dir` 参数，支持将项目存储到自定义目录。
  - API 端点 `POST /api/v1/compose/import` 请求体新增可选 `dir` 字段。

### 修复
- **i18n 全面补全**:
  - 在 `en.json` 与 `zh.json` 中完整补全了 Compose UI 相关词汇、容器常用 CPU% / 内存等状态的中英文对照翻译。

---

## 2026-05-18 — 安全加固 + 多租户支持

### 新增
- **数据库迁移系统**: 使用 golang-migrate 管理 schema，支持增量迁移
- **用户级文件系统隔离**: 每个用户可配置独立的 Quadlet 目录
- **SettingsPage 编辑功能**: 可编辑 quadlet 目录和 podman socket 路径
- **统一开发环境**: `make dev` 同时启动 Go (Air) + Vite 热重载
- **WebSocket JWT 认证**: 所有 WS 连接需要有效 JWT token
- **Alert 启动预热**: 首次轮询快照当前状态，避免启动时误报

### 修复
- **Critical**: WebSocket 端点添加 JWT 认证（之前无认证即可连接）
- **Critical**: Exec WebSocket 修复 CORS CheckOrigin
- **Warning**: MkdirAll 错误正确处理（ScanDir + WriteFile）
- **Warning**: JWT secret INSERT 错误不再静默忽略
- **Warning**: Backup 导入添加 50MB 大小限制
- **Warning**: SettingsStore.Update 添加字段类型验证
- **Warning**: filenameToUnitName 修正为 Quadlet 规范（volume→-volume.service 等）

### 变更
- 开发端口从 8080 改为 9090
- `.gitignore` 精确匹配根目录二进制文件

---

## 2026-05-17 — Phase 1-6 完成

### Phase 1: 后端基础
- Go 模块初始化、配置系统、Provider 接口定义
- D-Bus SystemdProvider 实现（rootless/rootful 自动检测）
- Podman Socket HTTP 客户端
- QuadletFS 文件系统扫描器 + 安全校验
- Quadlet INI 解析器/生成器

### Phase 2: API 层
- Gin 路由 + 全部 REST 端点
- WebSocket Hub 实时推送
- CORS + 日志中间件

### Phase 3: 前端脚手架
- Vite + React + TypeScript
- Tailwind CSS 4 暗色主题
- Zustand 状态管理
- react-router 路由
- react-i18next 国际化 (EN/ZH)

### Phase 4: 前端 UI
- 侧边栏导航、顶部栏
- 仪表盘、单元列表、容器管理
- 镜像、存储卷、网络管理页面

### Phase 5: 编辑器和向导
- CodeMirror 6 集成（Quadlet INI 语法高亮）
- 配置向导表单模式
- 编辑器/表单双向切换

### Phase 6: 打磨
- 国际化完善
- 错误处理和加载状态
- Web 终端 (xterm.js)
- 备份导出/导入
- 用户管理页面
