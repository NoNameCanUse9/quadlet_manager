# 目录结构与文件说明

> 本文档详细说明 Quadlet Manager 项目中每个文件和目录的作用、依赖关系和修改频率。

---

## 一、项目根目录

```
quadlet-manager/
├── cmd/quadlet-manager/main.go
├── web.go
├── .air.toml
├── Makefile
├── go.mod / go.sum
├── .gitignore
└── CLAUDE.md
```

| 文件 | 作用 | 修改频率 | 关联文件 |
|------|------|----------|----------|
| `cmd/quadlet-manager/main.go` | **程序入口**。解析 CLI 参数，初始化数据库→认证→Provider→Service→Handler→路由，启动 HTTP 服务。所有层的组装都在这里完成。 | 中 | 所有 internal 包 |
| `web.go` | **前端嵌入声明**。`//go:embed all:web/dist` 将前端构建产物嵌入 Go 二进制，使程序成为单文件可执行。 | 低 | web/dist/ (构建产物) |
| `.air.toml` | **Air 热重载配置**。`make dev` 时 Go 代码变更自动重新编译重启。配置了端口 9090、排除 web/node_modules 等。 | 低 | Makefile |
| `Makefile` | **构建命令集合**。`make dev` (热重载开发), `make build` (生产构建), `make test` (测试)。 | 低 | web/package.json, .air.toml |
| `go.mod` / `go.sum` | **Go 依赖管理**。主要依赖: gin, godbus/dbus, gorilla/websocket, golang-migrate, bcrypt, jwt。 | 低 | - |
| `.gitignore` | **Git 忽略规则**。排除构建产物、数据库文件、工具配置。 | 低 | - |
| `CLAUDE.md` | **项目文档**。供开发者和 AI Agent 理解项目架构。 | 中 | - |

---

## 二、后端核心: internal/

```
internal/
├── config/          # 配置层
├── auth/            # 认证层
├── model/           # 数据模型层
├── provider/        # 外部系统接口层
├── service/         # 业务逻辑层
├── handler/         # HTTP 处理层
├── middleware/       # Gin 中间件
├── store/           # 数据持久层
├── parser/          # Quadlet 文件解析
├── updater/         # GitHub Release 更新检查
├── version/         # 版本号（ldflags 注入）
└── ws/              # WebSocket Hub
```

### 2.1 config/ — 配置层

| 文件 | 作用 | 导出 | 被谁使用 |
|------|------|------|----------|
| `config.go` | 定义 `Config` 结构体和 `New()` 工厂函数。自动检测 rootless（`os.Getuid() != 0`），计算默认 Quadlet 目录和 Podman Socket 路径。支持 CLI 参数覆盖。 | `Config`, `New()`, `Validate()` | main.go |
| `config_test.go` | 测试默认值、参数覆盖、边界验证。 | - | - |

**关键逻辑**: rootless 模式使用 `~/.config/containers/systemd/`，rootful 使用 `/etc/containers/systemd/`。Socket 路径同理。

### 2.2 auth/ — 认证层

| 文件 | 作用 | 导出 | 被谁使用 |
|------|------|------|----------|
| `jwt.go` | JWT token 的生成 (`CreateToken`) 和验证 (`ValidateToken`)。使用 HMAC-SHA256，token 包含 user_id/username/role，有效期 24 小时。 | `CreateToken()`, `ValidateToken()`, `Claims` | service.go, middleware/auth.go, ws/hub.go |
| `service.go` | 认证业务逻辑。`Register()` 注册用户（bcrypt 哈希密码），`Login()` 验证密码并返回 JWT（单条 SQL 查询），`HasAdmin()` 检查是否已有管理员。内部持有 `UserStore` 和 `SettingsStore`。 | `Service`, `NewService()` | handler/auth_handler.go, handler/settings_handler.go, main.go |
| `jwt_test.go` | 测试 token 生成/验证、过期、错误密钥。 | - | - |
| `service_test.go` | 测试注册/登录流程、重复用户、密码错误。 | - | - |

### 2.3 model/ — 数据模型层

| 文件 | 作用 | 定义的类型 | 被谁使用 |
|------|------|-----------|----------|
| `unit.go` | systemd 单元状态模型。 | `UnitStatus` (Name/Description/LoadState/ActiveState/SubState/SourcePath), `UnitChangeEvent` | service, handler, provider |
| `container.go` | Podman 容器模型。 | `ContainerInfo` (ID/Names/Image/State/Status), `ContainerStats` (CPU/Mem/Net), `ContainerInspect` | service, handler, provider |
| `quadlet.go` | Quadlet 文件模型。 | `QuadletFile` (Name/Path/Content/ModTime/Type) | service, handler, provider |
| `stats.go` | 统计聚合模型。 | `SystemStats` (Containers []ContainerStats) | handler, ws |
| `user.go` | 用户和设置模型。 | `User` (ID/Username/Role/CreatedAt), `UserSettings` (10 个字段) | auth, store, handler |

**注意**: model 包是纯数据定义，不包含业务逻辑。所有层都可以导入 model。

### 2.4 provider/ — 外部系统接口层

这是**最核心的抽象层**，定义了与外部系统（systemd、Podman、文件系统）交互的接口。

| 文件 | 作用 | 导出 | 被谁使用 |
|------|------|------|----------|
| `systemd.go` | **SystemdProvider 接口定义**。声明 Connect/Close/IsRootless、DaemonReload/StartUnit/StopUnit/RestartUnit/EnableUnit/DisableUnit、ListUnits/GetUnitStatus、SubscribeUnitChanges。 | `SystemdProvider` 接口 | service/unit_service.go |
| `systemd_dbus.go` | **D-Bus 实现**。rootless 用 `dbus.NewUserConnectionContext`，rootful 用 `dbus.NewSystemConnectionContext`。通过 `org.freedesktop.systemd1.Manager` 调用 systemd。 | `DBusSystemdProvider`, `NewDBusSystemdProvider()` | main.go |
| `podman.go` | **PodmanProvider 接口定义**。声明容器/镜像/卷/网络的 CRUD 操作，以及 ExecCreate/ExecAttach（Web 终端）。 | `PodmanProvider` 接口 | service/container_service.go 等 |
| `podman_socket.go` | **Podman Socket 实现**。通过 HTTP over Unix Socket 调用 Podman libpod API (v5.0.0)。不依赖 CGO。配置连接池（MaxIdleConns=10, IdleConnTimeout=90s），容器日志限制 10MB。 | `SocketPodmanProvider`, `NewSocketPodmanProvider()` | main.go |
| `quadletfs.go` | **QuadletFS 接口定义**。声明 ScanDir/ReadFile/WriteFile/DeleteFile/ValidateFilename。 | `QuadletFS` 接口 | service/file_service.go, service/unit_service.go |
| `quadletfs_impl.go` | **文件系统实现**。ScanDir 扫描目录并过滤合法 Quadlet 文件。ValidateFilename 防止路径遍历（白名单扩展名 + filepath.Clean）。WriteFile 自动创建目录。 | `QuadletFSImpl`, `NewQuadletFSImpl()` | main.go, service 内部 |
| `mock_systemd.go` | **SystemdProvider Mock**。内存中模拟 Units map，可控返回错误。用于测试。 | `MockSystemd`, `NewMockSystemd()` | 测试文件 |
| `mock_podman.go` | **PodmanProvider Mock**。内存中模拟容器/镜像列表。 | `MockPodman`, `NewMockPodman()` | 测试文件 |
| `mock_quadletfs.go` | **QuadletFS Mock**。内存中模拟 Files map。 | `MockQuadletFS`, `NewMockQuadletFS()` | 测试文件 |
| `*_test.go` | 接口合规性测试 + 文件名验证测试 + FS CRUD 测试。 | - | - |

**设计原则**: 所有 provider 接口都有 Mock 实现，service 层只依赖接口不依赖实现，测试时注入 Mock。

### 2.5 service/ — 业务逻辑层

| 文件 | 作用 | 关键方法 | 被谁使用 |
|------|------|----------|----------|
| `unit_service.go` | **单元生命周期管理**。`ListUnits` 扫描 Quadlet 文件→映射为 systemd 单元名→过滤 D-Bus 返回的单元列表。`StartUnit` 直接启动（不调 DaemonReload，仅 ApplyFile 后调用）。支持用户级目录隔离（`resolveFS` + sync.Map 缓存 10s TTL）。 | `ListUnits(ctx, userID)`, `StartUnit()`, `StopUnit()`, `RestartUnit()`, `EnableUnit()`, `DisableUnit()`, `DaemonReload()` | handler/unit_handler.go |
| `file_service.go` | **Quadlet 文件 CRUD**。`ApplyFile` 是核心：写入文件→DaemonReload→StartUnit。`ValidateContent` 解析 INI 并检查 Image 是否存在。定义 `SettingsLookup` 接口用于用户目录解析。`resolveFS` 使用 sync.Map 缓存用户目录（10s TTL）。 | `ListFiles()`, `ReadFile()`, `WriteFile()`, `DeleteFile()`, `ApplyFile()`, `ValidateContent()` | handler/file_handler.go |
| `container_service.go` | **容器操作封装**。直接代理到 PodmanProvider。 | `ListContainers()`, `GetContainerLogs()`, `PauseContainer()`, `InspectContainer()` | handler/container_handler.go |
| `orchestrator.go` | **容器编排器**。协调 systemd 和 podman：判断容器是否由 Quadlet 管理（`IsManaged`），如果是则通过 systemd 控制，否则直接操作 podman。 | `Start()`, `Stop()`, `Restart()`, `Remove()`, `IsManaged()` | handler/container_handler.go |
| `image_service.go` | **镜像操作封装**。代理到 PodmanProvider。`PullImage` 支持镜像站代理：查询用户设置的 `mirrorRegistry`，若镜像名无 registry 前缀则自动拼接。 | `ListImages()`, `PullImage(ctx, userID, name)`, `RemoveImage()`, `InspectImage()` | handler/image_handler.go |
| `volume_service.go` | **存储卷操作封装**。`CreateVolume` 支持 `opts` 参数，指定宿主机路径时创建 bind mount 卷。 | `ListVolumes()`, `CreateVolume(ctx, name, labels, opts)`, `RemoveVolume()`, `InspectVolume()` | handler/volume_handler.go |
| `network_service.go` | **网络操作封装**。 | `ListNetworks()`, `CreateNetwork()`, `RemoveNetwork()`, `InspectNetwork()` | handler/network_handler.go |
| `backup_service.go` | **备份服务**。`Export` 将 Quadlet 文件打包为 tar.gz。`Import` 解压并写入。 | `Export()`, `Import()` | handler/backup_handler.go |
| `service_test.go` | 单元启动/列表、文件 CRUD/验证、编排器测试。 | - | - |
| `orchestrator_test.go` | 编排器孤立容器检测测试。 | - | - |

**关键设计**: `resolveFS(ctx, userID)` 是用户隔离的核心——根据 userID 查询 settings 表获取自定义 quadlet_dir，返回对应的 QuadletFS 实例。使用 `sync.Map` 缓存用户目录路径（10 秒 TTL），减少 DB 查询。

### 2.6 handler/ — HTTP 处理层

| 文件 | 作用 | 路由 | 认证 |
|------|------|------|------|
| `auth_handler.go` | 认证处理。`CheckInit` 检查是否有管理员，`InitAdmin` 首次创建管理员，`Login` 登录返回 JWT，`Me` 返回当前用户，`Register`/`ListUsers`/`DeleteUser`/`UpdateUser` 管理用户。 | /api/v1/auth/* | 部分公开 |
| `unit_handler.go` | 单元操作。从 context 提取 userID 传给 service。 | /api/v1/units/*, /api/v1/daemon/reload | JWT |
| `file_handler.go` | 文件操作。所有方法提取 userID 用于用户级目录解析。 | /api/v1/files/* | JWT |
| `container_handler.go` | 容器操作。生命周期控制通过 orchestrator，信息查询通过 containerService。 | /api/v1/containers/* | JWT |
| `exec_handler.go` | **Web 终端**。`ExecCreate` 创建 exec 会话返回 exec_id，`ExecWebSocket` 升级 WS 连接并双向桥接 Podman exec attach。JWT 认证通过 query param。 | /api/v1/containers/:id/exec, .../ws | JWT |
| `image_handler.go` | 镜像操作。 | /api/v1/images/* | JWT |
| `volume_handler.go` | 存储卷操作。 | /api/v1/volumes/* | JWT |
| `network_handler.go` | 网络操作。 | /api/v1/networks/* | JWT |
| `backup_handler.go` | 备份导出/导入。导入限制 50MB。 | /api/v1/backup/* | JWT |
| `settings_handler.go` | 用户设置读取/更新。更新时验证 quadlet_dir 必须是存在的绝对路径。 | /api/v1/settings | JWT |
| `stats_handler.go` | 容器统计快照。 | /api/v1/stats | JWT |
| `system_handler.go` | 系统信息（rootless/port/quadletDir/version）+ 更新检查。 | /api/v1/system/info, /api/v1/system/update, /api/v1/system/update/check | JWT |
| `handler_test.go` | Handler 层集成测试（通过 httptest + Gin 路由）。 | - | - |
| `auth_handler_test.go` | 认证 Handler 完整测试（17 个用例覆盖所有认证流程）。 | - | - |

**模式**: 每个 Handler 方法都是 `func(c *gin.Context)`，提取 userID→调用 service→返回 JSON。

### 2.7 middleware/ — Gin 中间件

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `auth.go` | `JWTAuth` 从 Authorization header 提取 Bearer token，验证后设置 user_id/username/role 到 context。`RequireRole` 检查角色权限。 | main.go (protected 路由组) |
| `cors.go` | CORS 中间件。允许所有来源（开发用）。 | main.go (全局) |
| `logger.go` | 请求日志中间件。 | main.go (全局) |

### 2.8 store/ — 数据持久层

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `db.go` | SQLite 初始化。使用 `golang-migrate` 自动执行 `migrations/*.sql`。WAL 模式 + 外键约束 + busy_timeout=5000 + synchronous=NORMAL。SetMaxOpenConns(1) 避免锁竞争。 | main.go |
| `user_store.go` | 用户表 CRUD。`Create`/`GetByID`/`GetByUsername`/`GetByUsernameWithHash`/`ListAll`/`Delete`/`UpdateRole`/`UpdatePassword`/`HasAdmin`。 | auth/service.go |
| `settings_store.go` | 用户设置表 CRUD。`GetByUserID`（不存在时自动创建默认行并直接返回，无递归查询）/`Update`（带字段类型验证）。 | auth/service.go, service 层 (via SettingsLookup) |
| `migrations/001_init.up.sql` | 初始 schema: users + user_settings + config 三张表。 | db.go (embed) |
| `migrations/001_init.down.sql` | 回滚脚本。 | db.go (embed) |
| `migrations/002_add_mirror_registry.up.sql` | 新增 `mirror_registry` 列。 | db.go (embed) |
| `migrations/002_add_mirror_registry.down.sql` | 回滚脚本。 | db.go (embed) |
| `*_test.go` | Store 层测试（内存数据库）。 | - | - |

**迁移机制**: 在 `migrations/` 目录创建 `002_xxx.up.sql` 和 `002_xxx.down.sql`，重启服务自动执行。

### 2.9 parser/ — Quadlet 文件解析

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `quadlet_parser.go` | INI 解析器。将 Quadlet 文件内容解析为 `QuadletConfig` 结构体（Unit/Container/Service/Install 四个 section）。支持多值 key（如多个 PublishPort）。 | service/file_service.go |
| `quadlet_generator.go` | INI 生成器。将 `QuadletConfig` 结构体序列化为 INI 字符串。用于表单模式→文件内容。 | service/file_service.go |
| `quadlet_parser_test.go` | 解析/生成往返测试、多值 key 测试。 | - | - |

### 2.10 updater/ — GitHub Release 更新检查

| 文件 | 作用 | 导出 | 被谁使用 |
|------|------|------|----------|
| `checker.go` | **更新检查器**。`Checker` 定期调用 GitHub Releases API 检查新版本，结果缓存在内存中。`Check()` 手动触发检查，`GetCached()` 获取缓存结果，`StartPeriodicCheck()` 启动后台 goroutine（每 24 小时）。使用 `semver` 进行版本比较，`dev` 版本始终认为有更新。 | `Checker`, `UpdateInfo`, `NewChecker()` | main.go, handler/system_handler.go |
| `checker_test.go` | 版本比较测试（semver/非 semver/dev）、Mock HTTP Server 测试 Checker.Check 成功和网络错误。 | - | - |

### 2.11 version/ — 版本号

| 文件 | 作用 | 导出 | 被谁使用 |
|------|------|------|----------|
| `version.go` | 版本号变量，构建时通过 ldflags 注入。默认 `"dev"`。 | `Version` | main.go, handler/system_handler.go |

### 2.12 ws/ — WebSocket Hub

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `hub.go` | **WebSocket 消息中心**。管理客户端连接注册/注销，消息广播。`HandleWebSocket` 处理 WS 升级（含 JWT 认证）。`StartStatsBroadcaster` 定时推送容器统计。`StartAlertBroadcaster` 检测单元失败并推送告警（含启动预热、map 预分配）。`Run(ctx)` 支持 context 取消优雅关闭。 | main.go, handler/stats_handler.go |

---

## 三、前端: web/

```
web/
├── src/
│   ├── api/          # API 客户端
│   ├── store/        # Zustand 状态管理
│   ├── hooks/        # TanStack Query hooks
│   ├── pages/        # 页面组件
│   ├── components/   # 共享组件
│   ├── router/       # 路由定义
│   ├── i18n/         # 国际化
│   ├── providers/    # React Provider
│   ├── lib/          # 工具函数
│   ├── App.tsx       # 根组件
│   └── main.tsx      # 入口
├── vite.config.ts    # Vite 配置
├── tsconfig.json     # TypeScript 配置
├── components.json   # shadcn/ui 配置
└── package.json      # npm 依赖
```

### 3.1 api/ — API 客户端

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `client.ts` | **唯一 API 客户端**。封装 fetch，自动附加 JWT token，401 时自动登出。导出 `api` 对象包含所有后端 API 调用方法。同时定义所有 TypeScript 接口（SystemInfo, UnitStatus, ContainerInfo 等）。 | 所有 hooks 和 pages |

**重要**: 新增 API 端点时，必须在此文件添加对应方法和类型定义。

### 3.2 store/ — Zustand 状态管理

| 文件 | 作用 | 管理的状态 | 被谁使用 |
|------|------|-----------|----------|
| `useAuth.ts` | **认证状态**。token 存 localStorage。提供 login/logout/initAdmin/checkInit/fetchMe 方法。首次访问时 checkInit 判断跳转到 InitPage 还是 LoginPage。 | token, user, initialized, loading, error | AuthGuard, LoginPage, InitPage, AppSidebar |
| `useApp.ts` | **应用状态**。files (Quadlet 文件列表), systemInfo (系统信息)。 | files, systemInfo, loading | FilesPage, AppSidebar |
| `useUnits.ts` | **单元状态**。fetchUnits 从 API 获取单元列表。 | units, loading, error | FilesPage |
| `useContainers.ts` | **容器状态**。fetchContainers + fetchStats。 | containers, stats, loading, error | ContainersPage, DashboardPage |

**注意**: Zustand store 用于全局状态，TanStack Query hooks 用于数据获取和缓存。两者并存。

### 3.3 hooks/ — TanStack Query hooks

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `useUnits.ts` | 单元查询/变更 hooks。`useUnits()` 获取列表，`useStartUnit()` 等 mutation hooks。 | FilesPage |
| `useContainers.ts` | 容器查询 hooks。 | ContainersPage |
| `useImages.ts` | 镜像查询 hooks。 | ImagesPage |
| `useVolumes.ts` | 存储卷查询 hooks。 | VolumesPage |
| `useNetworks.ts` | 网络查询 hooks。 | NetworksPage |
| `useWebSocket.ts` | WebSocket 连接 hook。自动重连，解析消息类型。 | DashboardPage |
| `useCompose.ts` | Compose 项目 hooks。`useComposeProjects()` 获取列表，`useComposeUp/Down()` 启停，`useConvertCompose()` 转换。 | ContainersPage |

### 3.4 pages/ — 页面组件

| 文件 | 作用 | 路由 | 关键依赖 |
|------|------|------|----------|
| `InitPage.tsx` | **首次初始化页面**。检查 `/api/v1/auth/init`，如果无管理员则显示创建表单。创建成功后跳转主页。 | /init | useAuth |
| `LoginPage.tsx` | **登录页面**。用户名/密码表单，登录成功后跳转主页。 | /login | useAuth |
| `DashboardPage.tsx` | **仪表盘**。显示容器统计卡片、单元状态概览。使用 WebSocket 接收实时更新。 | / (index) | useContainers, useWebSocket |
| `ContainersPage.tsx` | **容器管理页面**。列出所有容器，支持生命周期操作（启动/停止/暂停/删除）、查看日志、打开终端。顶部集成 Compose 项目管理（导入/启停/转换/删除）。 | /containers | useContainers, useCompose hooks |
| `ImagesPage.tsx` | **镜像管理页面**。列出镜像，支持拉取/删除。 | /images | useImages hooks |
| `VolumesPage.tsx` | **存储卷管理页面**。列出存储卷，支持创建/删除。 | /volumes | useVolumes hooks |
| `NetworksPage.tsx` | **网络管理页面**。列出网络，支持创建/删除。 | /networks | useNetworks hooks |
| `FilesPage.tsx` | **Quadlet 编排控制中心**（主路由 `/files`）。将新建、编辑器（CodeMirror）、向导表单（ConfigWizard）与 Systemd 单元状态及生命周期控制（运行监控、启动/停止/重启、开机自启、一键部署）深度合二为一的大一统交互面板。 | /files | useApp, useUnits |
| `TerminalPage.tsx` | **Web 终端**。xterm.js 终端模拟器，通过 WebSocket 连接到 Podman exec 会话。 | /containers/:id/exec/:exec_id | api client |
| `SettingsPage.tsx` | **用户设置页面**。可编辑语言、quadlet 目录、podman socket。修改后调用 API 保存。 | /settings | api client |
| `AdminUsersPage.tsx` | **用户管理页面**（admin only）。列出用户，支持创建/删除/修改角色/重置密码。 | /admin/users | api client |
| `BackupPage.tsx` | **备份页面**。导出 Quadlet 文件为 tar.gz，导入备份文件恢复。 | /backup | api client |

### 3.5 components/ — 共享组件

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `layout/AppLayout.tsx` | **主布局**。Sidebar + Header + Content 区域。所有认证后页面都在此布局内。 | router |
| `layout/AppSidebar.tsx` | **侧边栏导航**。菜单项: Dashboard, Units, Containers, Images, Volumes, Networks, Files, Settings, Admin, Backup。底部显示系统状态。 | AppLayout |
| `layout/AppHeader.tsx` | **顶部栏**。显示当前页面标题、用户信息、登出按钮。 | AppLayout |
| `editor/QuadletEditor.tsx` | **CodeMirror 6 编辑器封装**。自定义 Quadlet INI 语法高亮、暗色主题。 | FilesPage |
| `editor/ViewToggle.tsx` | **编辑器/表单模式切换**。 | FilesPage |
| `wizard/ConfigWizard.tsx` | **配置向导表单**。Image/Port/Volume/Environment 等字段的表单编辑，双向同步编辑器内容。 | FilesPage |
| `compose/ImportComposeDialog.tsx` | **导入 Compose 弹窗**。输入项目名 + 粘贴 `docker-compose.yml` 内容。 | ContainersPage |
| `compose/ComposeProjectCard.tsx` | **Compose 项目卡片**。显示项目名/状态/服务列表，支持启动/停止/转换/删除操作。 | ContainersPage |
| `compose/ConvertPreviewDialog.tsx` | **转换预览弹窗**。显示转换后的 Quadlet 文件内容，支持 Tab 切换多文件、复制、警告提示。 | ContainersPage |
| `AuthGuard.tsx` | **路由守卫**。未认证时跳转 /login，未初始化时跳转 /init。 | router |
| `ErrorBoundary.tsx` | **错误边界**。捕获 React 渲染错误，显示降级 UI。 | router |
| `ui/ErrorBanner.tsx` | 错误提示横幅组件。 | 各页面 |
| `ui/LoadingSpinner.tsx` | 加载动画组件。 | 各页面 |

### 3.6 router/ — 路由定义

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `index.tsx` | 使用 `react-router` 的 `createBrowserRouter` 定义所有路由。公开路由 (/login, /init)，认证路由包裹在 AuthGuard + AppLayout 内。所有页面组件使用 lazy import。 | App.tsx |

### 3.7 i18n/ — 国际化

| 文件 | 作用 | 被谁使用 |
|------|------|----------|
| `index.ts` | i18next 初始化。默认语言 zh，支持 en/zh 切换。 | main.tsx |
| `en.json` | 英文翻译。 | i18n |
| `zh.json` | 中文翻译。 | i18n |

**添加翻译**: 在 en.json 和 zh.json 中同步添加 key。使用 `useTranslation` hook 在组件中调用 `t('key')`。

### 3.8 其他前端文件

| 文件 | 作用 |
|------|------|
| `App.tsx` | 根组件，渲染 RouterProvider。 |
| `main.tsx` | 入口文件，挂载 React app + QueryProvider + i18n。 |
| `lib/utils.ts` | `cn()` 工具函数（clsx + tailwind-merge）。 |
| `providers/QueryProvider.tsx` | TanStack QueryClient Provider 配置。 |
| `vite.config.ts` | Vite 配置。开发模式代理 /api 和 /ws 到 localhost:9090。 |
