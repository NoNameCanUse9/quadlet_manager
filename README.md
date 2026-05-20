<div align="center">

# Quadlet Manager

**一个类 Portainer 的 Podman Quadlet 编排工具，通过 systemd D-Bus 管理 Quadlet 单元，提供现代化 Web UI。**

[![CI](https://github.com/NoNameCanUse9/quadlet_manager/actions/workflows/ci.yml/badge.svg)](https://github.com/NoNameCanUse9/quadlet_manager/actions/workflows/ci.yml)
[![Release](https://github.com/NoNameCanUse9/quadlet_manager/actions/workflows/release.yml/badge.svg)](https://github.com/NoNameCanUse9/quadlet_manager/releases)
[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 核心特性

- **Quadlet 文件管理** — 创建/编辑/删除 `.container`, `.volume`, `.network`, `.pod`, `.kube`, `.image` 文件，CodeMirror 6 语法高亮编辑器 + 可视化表单向导
- **Systemd 单元控制** — 通过 D-Bus 启动/停止/重启/启用/禁用 systemd 服务，一键 Deploy 自动启用开机自启
- **容器管理** — 通过 Podman Socket API 管理容器生命周期、查看日志、Web 终端 (xterm.js)
- **Docker Compose 兼容** — 导入 docker-compose.yml，通过 podman compose 管理，支持转换为 Quadlet 文件
- **开机自启管理** — 容器页面支持 Quadlet 管理容器的开机自启开关
- **镜像站代理** — 设置镜像站前缀，pull 镜像时自动拼接，国内用户友好
- **资源管理** — 镜像拉取/删除、存储卷/网络 CRUD（支持指定宿主机路径 bind mount）
- **用户认证** — JWT 认证，admin/user 角色，用户级资源隔离
- **实时推送** — WebSocket 推送容器统计和单元状态变更
- **OTA 更新** — 定期检查 GitHub Release，自动识别架构，一键下载对应二进制
- **备份与恢复** — 导出/导入 Quadlet 文件 tar.gz 归档
- **单文件部署** — 前端嵌入 Go 二进制，零外部依赖

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.22+, Gin, godbus/dbus, gorilla/websocket |
| 前端 | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui |
| 数据库 | SQLite3 + golang-migrate |
| 认证 | JWT (golang-jwt), bcrypt |
| 编辑器 | CodeMirror 6 |
| 终端 | xterm.js |

## 快速上手

### 前置要求

- **Go** 1.22+
- **Node.js** 20+（构建前端用）
- **Podman** 4.0+
- **systemd**（用户级或系统级）

### 从 Release 下载

从 [GitHub Releases](https://github.com/NoNameCanUse9/quadlet_manager/releases) 下载对应架构的二进制：

```bash
# amd64
curl -LO https://github.com/NoNameCanUse9/quadlet_manager/releases/latest/download/quadlet-manager-linux-amd64
chmod +x quadlet-manager-linux-amd64
mv quadlet-manager-linux-amd64 /usr/local/bin/quadlet-manager

# arm64
curl -LO https://github.com/NoNameCanUse9/quadlet_manager/releases/latest/download/quadlet-manager-linux-arm64
chmod +x quadlet-manager-linux-arm64
mv quadlet-manager-linux-arm64 /usr/local/bin/quadlet-manager
```

### 从源码构建

```bash
git clone https://github.com/NoNameCanUse9/quadlet_manager.git
cd quadlet_manager
make build
# 产物在 bin/quadlet-manager
```

### 运行

```bash
# 直接运行（默认端口 8080）
quadlet-manager

# 指定端口
quadlet-manager --port 9090

# 所有 CLI 参数
quadlet-manager \
  --port 9090 \
  --quadlet-dir /path/to/quadlet \
  --podman-socket /run/user/1000/podman/podman.sock \
  --db /path/to/quadlet.db \
  --jwt-secret your-secret-key
```

首次访问 Web UI 会引导创建管理员账号。

## Systemd 服务配置

### Rootless（用户级）

```ini
# ~/.config/systemd/user/quadlet-manager.service
[Unit]
Description=Quadlet Manager
After=network-online.target podman.socket

[Service]
Type=simple
ExecStart=/usr/local/bin/quadlet-manager --port 9090
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now quadlet-manager.service
systemctl --user status quadlet-manager.service
```

### Rootful（系统级）

```ini
# /etc/systemd/system/quadlet-manager.service
[Unit]
Description=Quadlet Manager
After=network-online.target podman.socket

[Service]
Type=simple
ExecStart=/usr/local/bin/quadlet-manager --port 9090
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now quadlet-manager.service
systemctl status quadlet-manager.service
```

### Quadlet 方式部署（推荐）

```ini
# ~/.config/containers/systemd/quadlet-manager.container
[Unit]
Description=Quadlet Manager
After=network-online.target

[Container]
Image=docker.io/golang:1.22-alpine
Exec=quadlet-manager --port 9090
PublishPort=9090:9090
Volume=quadlet-manager-data.volume:/data
Environment=DB=/data/quadlet.db

[Service]
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

> **注意**: 上述 Quadlet 示例仅作参考。推荐直接用二进制 + systemd unit 部署。

## CLI 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | `8080` | HTTP 服务端口 |
| `--rootless` | 自动检测 | 强制 rootless 模式 |
| `--quadlet-dir` | 自动检测 | Quadlet 文件扫描目录 |
| `--podman-socket` | 自动检测 | Podman Socket 路径 |
| `--db` | `quadlet.db` | SQLite 数据库路径 |
| `--jwt-secret` | 自动生成 | JWT 签名密钥 |
| `--dev` | `false` | 开发模式（代理到 Vite） |

## 开发

```bash
# 前后端热重载开发
make dev

# 仅后端
make dev-backend

# 仅前端
make dev-frontend

# 运行测试
make test

# 生产构建
make build

# Lint
make lint
```

## 项目结构

```
quadlet-manager/
├── cmd/quadlet-manager/   # 程序入口
├── internal/
│   ├── auth/              # JWT 认证
│   ├── config/            # 配置解析
│   ├── handler/           # HTTP 处理层
│   ├── middleware/         # Gin 中间件
│   ├── model/             # 数据模型
│   ├── parser/            # Quadlet INI 解析器
│   ├── provider/          # 外部系统接口（systemd/Podman/FS）
│   ├── service/           # 业务逻辑层
│   ├── store/             # SQLite 持久层 + 迁移
│   ├── updater/           # GitHub Release 更新检查
│   ├── version/           # 版本号（ldflags 注入）
│   └── ws/                # WebSocket Hub
├── web/                   # React 前端
├── docs/                  # 文档
└── Makefile
```

## 文档

- [API 参考](docs/API.md)
- [架构说明](docs/ARCHITECTURE.md)
- [变更日志](docs/CHANGELOG.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试指南](docs/TESTING.md)
- [故障排除](docs/TROUBLESHOOTING.md)

## License

[MIT](LICENSE)
