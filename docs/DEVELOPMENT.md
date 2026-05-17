# 开发者指南

## 快速开始

### 环境要求

- Go 1.22+
- Node.js 18+
- Linux (D-Bus + Podman 用于完整功能)

### 启动开发环境

```bash
# 方式 1: 一键启动（推荐）
make dev

# 方式 2: 分别启动
# 终端 1: Go 后端
go run ./cmd/quadlet-manager --dev --port 9090

# 终端 2: Vite 前端
cd web && npm run dev
```

访问 http://localhost:5173 (Vite) 或 http://localhost:9090 (Go 嵌入)

### 首次使用

1. 访问页面，自动跳转到初始化页面
2. 创建管理员账号
3. 开始使用

---

## 架构决策记录

### 为什么用 SQLite 而不是 PostgreSQL？

这是一个本地工具，SQLite 足够：
- 零配置部署
- 单文件数据库，易于备份
- WAL 模式支持并发读写
- 嵌入式，无外部依赖

### 为什么用 JWT 而不是 Session？

- 无状态，不需要服务端 session 存储
- WebSocket 认证简单（query param 传递 token）
- 适合单页应用

### 为什么用 D-Bus 而不是 systemctl 命令行？

- D-Bus 是 systemd 的原生 API
- 可以订阅实时信号（单元状态变更）
- 避免进程创建开销
- 支持 rootless 用户级 systemd

### 为什么用 Podman Socket 而不是 Podman Go SDK？

- 避免 CGO 依赖（libpod SDK 需要）
- HTTP over Unix socket 简单可靠
- API 版本化清晰（/v5.0.0/libpod/...）
- 更轻量的二进制文件

### 为什么用 CodeMirror 6 而不是 Monaco Editor？

- 更小的包体积（~100KB vs ~2MB）
- 更好的嵌入支持
- 可扩展的语法解析
- 更适合 INI 格式高亮

---

## 数据流

### 文件创建流程

```
前端: api.createFile("nginx.container", content)
  ↓
Handler: file_handler.go → CreateFile()
  → 提取 userID from JWT
  → 调用 service.WriteFile(ctx, userID, filename, content)
  ↓
Service: file_service.go → WriteFile()
  → ValidateFilename() 检查安全性
  → resolveFS(ctx, userID) 解析用户目录
  → fs.WriteFile() 写入磁盘
  ↓
Provider: quadletfs_impl.go → WriteFile()
  → MkdirAll 确保目录存在
  → os.WriteFile 写入文件
```

### 单元启动流程

```
前端: api.startUnit("nginx.service")
  ↓
Handler: unit_handler.go → StartUnit()
  → 调用 service.StartUnit(ctx, name)
  ↓
Service: unit_service.go → StartUnit()
  → systemd.DaemonReload() 先重载配置
  → systemd.StartUnit() 启动单元
  ↓
Provider: systemd_dbus.go → StartUnit()
  → conn.StartUnit(name, "replace")
  → D-Bus 调用 org.freedesktop.systemd1.Manager.StartUnit
```

### WebSocket 推送流程

```
Hub.StartStatsBroadcaster() 定时任务 (5秒)
  → containerSvc.GetAllStats()
  → hub.Broadcast({ type: "stats_update", data: stats })
  → 遍历所有已认证的 WS 客户端
  → conn.WriteMessage(json)
```

---

## 文件命名约定

### Quadlet 文件

- 扩展名白名单: `.container`, `.volume`, `.network`, `.pod`, `.kube`, `.image`
- 文件名不能包含 `/` 或 `\`
- 不能使用 `..` 路径遍历

### systemd 单元映射

| 文件类型 | 文件名 | 单元名 |
|----------|--------|--------|
| .container | nginx.container | nginx.service |
| .volume | data.volume | data-volume.service |
| .network | mynet.network | mynet-network.service |
| .pod | mypod.pod | mypod-pod.service |
| .kube | app.kube | app-kube.service |
| .image | base.image | base-image.service |

注意: `.container` 直接映射为 `.service`，其他类型添加 `-type` 后缀。

---

## 调试技巧

### 后端调试

```bash
# 查看请求日志
GIN_DEBUG=true go run ./cmd/quadlet-manager --dev --port 9090

# 查看 SQL 查询
# 在 db.go 中设置 _journal_mode=WAL&_foreign_keys=on 已启用

# 测试特定包
go test -v -run TestSpecificFunction ./internal/service/
```

### 前端调试

```bash
# TypeScript 类型检查
cd web && npx tsc --noEmit

# 查看打包大小
cd web && npx vite-bundle-visualizer
```

### 数据库调试

```bash
# 查看 SQLite 数据库内容
sqlite3 ~/.config/quadlet-manager/data.db

# 查看表结构
.tables
.schema users
.schema user_settings

# 查看迁移版本
SELECT * FROM schema_migrations;
```

---

## 添加新 Provider

如果需要支持新的容器运行时或 init 系统：

1. 在 `internal/provider/` 定义接口
2. 创建实现文件
3. 创建 Mock 实现（用于测试）
4. 在 `cmd/quadlet-manager/main.go` 中初始化
5. 注入到 Service 层

```go
// 1. 定义接口
type NewRuntimeProvider interface {
    DoSomething(ctx context.Context) error
}

// 2. 实现
type NewRuntimeImpl struct { ... }
func (p *NewRuntimeImpl) DoSomething(ctx context.Context) error { ... }

// 3. Mock
type MockNewRuntime struct { ... }
func (m *MockNewRuntime) DoSomething(ctx context.Context) error { ... }
```

---

## 性能注意事项

- SQLite WAL 模式支持并发读
- WebSocket Hub 使用 channel 避免锁竞争
- 前端使用 TanStack Query 缓存 API 响应
- Quadlet 文件扫描使用 os.ReadDir（高效目录读取）
- Podman Stats 使用 stream=false 避免长连接
