# API 参考文档

## 基础信息

- Base URL: `http://localhost:9090/api/v1`
- 认证: JWT Bearer Token（除公开端点外）
- Content-Type: `application/json`
- WebSocket: `ws://localhost:9090/api/v1/ws?token=<jwt>`

## 错误响应格式

```json
{
  "error": "错误描述"
}
```

## 认证

### 检查初始化状态

```
GET /api/v1/auth/init
```

**响应**:
```json
{ "initialized": false }
```

### 创建管理员（首次）

```
POST /api/v1/auth/init
```

**请求**:
```json
{ "username": "admin", "password": "admin" }
```

**响应**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "createdAt": "2026-05-17T20:00:28Z"
  }
}
```

### 登录

```
POST /api/v1/auth/login
```

**请求**:
```json
{ "username": "admin", "password": "admin" }
```

**响应**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

### 获取当前用户

```
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**响应**:
```json
{
  "user": { "id": 1, "username": "admin", "role": "admin" },
  "settings": {
    "userId": 1,
    "language": "en",
    "theme": "dark",
    "quadletDir": "",
    "podmanSocket": "",
    "itemsPerPage": 20,
    "autoRefreshSeconds": 30,
    "defaultRestartPolicy": "always",
    "notifyOnFailure": true
  }
}
```

---

## 系统

### 系统信息

```
GET /api/v1/system/info
Authorization: Bearer <token>
```

**响应**:
```json
{
  "port": 9090,
  "rootless": true,
  "quadletDir": "/home/user/.config/containers/systemd",
  "version": "v1.0.0"
}
```

### 获取更新信息

```
GET /api/v1/system/update
Authorization: Bearer <token>
```

返回缓存的 GitHub Release 更新检查结果。后端每 24 小时自动检查一次。

**响应**:
```json
{
  "current": "v1.0.0",
  "latest": "v1.1.0",
  "hasUpdate": true,
  "releaseUrl": "https://github.com/choken/quadlet-manager/releases/tag/v1.1.0",
  "releaseNote": "## Changes\n- feat: add OTA update",
  "publishedAt": "2026-05-20T10:00:00Z",
  "checkedAt": "2026-05-20T14:30:00Z"
}
```

### 手动检查更新

```
POST /api/v1/system/update/check
Authorization: Bearer <token>
```

立即触发一次 GitHub Release 检查，返回最新的更新信息（格式同上）。

---

## 单元管理

### 列出单元

```
GET /api/v1/units
Authorization: Bearer <token>
```

**响应**:
```json
[
  {
    "name": "nginx.service",
    "description": "Nginx Web Server",
    "loadState": "loaded",
    "activeState": "active",
    "subState": "running",
    "sourcePath": "/home/user/.config/containers/systemd/nginx.container"
  }
]
```

### 启动单元

```
POST /api/v1/units/:name/start
Authorization: Bearer <token>
```

**响应**:
```json
{ "status": "started" }
```

### 停止单元

```
POST /api/v1/units/:name/stop
Authorization: Bearer <token>
```

### 重启单元

```
POST /api/v1/units/:name/restart
Authorization: Bearer <token>
```

### 启用开机自启

```
POST /api/v1/units/:name/enable
Authorization: Bearer <token>
```

### 禁用开机自启

```
POST /api/v1/units/:name/disable
Authorization: Bearer <token>
```

### Daemon Reload

```
POST /api/v1/daemon/reload
Authorization: Bearer <token>
```

---

## 文件管理

### 列出文件

```
GET /api/v1/files
Authorization: Bearer <token>
```

**响应**:
```json
[
  {
    "name": "nginx.container",
    "path": "/home/user/.config/containers/systemd/nginx.container",
    "content": "",
    "modTime": "2026-05-18T04:00:28Z",
    "type": "container"
  }
]
```

### 读取文件

```
GET /api/v1/files/:filename
Authorization: Bearer <token>
```

**响应**:
```json
{
  "filename": "nginx.container",
  "content": "[Unit]\nDescription=Nginx\n\n[Container]\nImage=nginx:latest\n"
}
```

### 创建文件

```
POST /api/v1/files
Authorization: Bearer <token>
```

**请求**:
```json
{
  "filename": "nginx.container",
  "content": "[Unit]\nDescription=Nginx\n\n[Container]\nImage=nginx:latest\nPublishPort=80:80\n"
}
```

**响应**:
```json
{ "filename": "nginx.container", "status": "created" }
```

### 更新文件

```
PUT /api/v1/files/:filename
Authorization: Bearer <token>
```

**请求**:
```json
{ "content": "[Container]\nImage=nginx:1.25\n" }
```

### 删除文件

```
DELETE /api/v1/files/:filename
Authorization: Bearer <token>
```

### 应用文件（保存+重载+启动）

```
POST /api/v1/files/:filename/apply
Authorization: Bearer <token>
```

**请求**:
```json
{ "content": "[Container]\nImage=nginx:latest\n" }
```

### 验证文件内容

```
POST /api/v1/files/validate
Authorization: Bearer <token>
```

**请求**:
```json
{ "content": "[Container]\nImage=nginx:latest\n" }
```

**响应**:
```json
{
  "valid": true,
  "warnings": []
}
```

---

## 容器管理

### 列出容器

```
GET /api/v1/containers
Authorization: Bearer <token>
```

**响应**:
```json
[
  {
    "id": "abc123",
    "names": ["nginx"],
    "image": "docker.io/nginx:latest",
    "state": "running",
    "status": "Up 2 hours"
  }
]
```

### 容器日志

```
GET /api/v1/containers/:id/logs?tail=100
Authorization: Bearer <token>
```

**响应**:
```json
{
  "id": "abc123",
  "logs": ["2026/05/18 04:00:00 [notice] 1#1: start worker processes"]
}
```

### 启动/停止/重启容器

```
POST /api/v1/containers/:id/start
POST /api/v1/containers/:id/stop
POST /api/v1/containers/:id/restart
Authorization: Bearer <token>
```

### 暂停/恢复容器

```
POST /api/v1/containers/:id/pause
POST /api/v1/containers/:id/unpause
Authorization: Bearer <token>
```

### 删除容器

```
DELETE /api/v1/containers/:id?force=true
Authorization: Bearer <token>
```

### 创建 Exec 会话

```
POST /api/v1/containers/:id/exec
Authorization: Bearer <token>
```

**请求**:
```json
{ "cmd": ["/bin/sh"] }
```

**响应**:
```json
{ "exec_id": "exec-abc123" }
```

---

## 镜像管理

### 列出镜像

```
GET /api/v1/images
Authorization: Bearer <token>
```

### 拉取镜像

```
POST /api/v1/images/pull
Authorization: Bearer <token>
```

**请求**:
```json
{ "name": "nginx:latest" }
```

**说明**: 若用户设置了 `mirrorRegistry`（如 `docker.io`），且镜像名无 registry 前缀，将自动拼接为 `docker.io/nginx:latest`。已含 registry 前缀的镜像名（如 `ghcr.io/foo/bar`）不受影响。

### 删除镜像

```
DELETE /api/v1/images/:id?force=true
Authorization: Bearer <token>
```

---

## 存储卷管理

### 列出存储卷

```
GET /api/v1/volumes
Authorization: Bearer <token>
```

### 创建存储卷

```
POST /api/v1/volumes
Authorization: Bearer <token>
```

**请求**:
```json
{ "name": "mydata", "labels": { "app": "myapp" }, "device": "/path/on/host" }
```

**说明**: `device` 为可选字段，指定宿主机目录路径后将创建 bind mount 类型的卷（`Driver: local`）。留空则创建普通卷。

### 删除存储卷

```
DELETE /api/v1/volumes/:name?force=true
Authorization: Bearer <token>
```

---

## 网络管理

### 列出网络

```
GET /api/v1/networks
Authorization: Bearer <token>
```

### 创建网络

```
POST /api/v1/networks
Authorization: Bearer <token>
```

**请求**:
```json
{ "name": "mynet", "driver": "bridge", "subnet": "10.88.0.0/16" }
```

### 删除网络

```
DELETE /api/v1/networks/:name
Authorization: Bearer <token>
```

---

## Compose 项目管理

### 列出项目

```
GET /api/v1/compose
Authorization: Bearer <token>
```

**响应**:
```json
[
  {
    "name": "myapp",
    "file": "/home/user/.config/containers/systemd/.compose/myapp/docker-compose.yml",
    "status": "running",
    "services": ["web", "db"]
  }
]
```

### 导入项目

```
POST /api/v1/compose/import
Authorization: Bearer <token>
```

**请求**:
```json
{
  "name": "myapp",
  "content": "services:\n  web:\n    image: nginx:latest\n    ports:\n      - \"8080:80\"\n",
  "dir": "/home/user/custom-dir"
}
```

- `name` (必填): 项目名称，仅允许 `[a-zA-Z0-9._-]`，首字符须为字母或数字
- `content` (必填): docker-compose.yml 文件内容
- `dir` (可选): 自定义存储目录，留空则使用默认 quadletDir 下的 `.compose/` 子目录

**响应**:
```json
{ "status": "imported" }
```

### 删除项目

```
DELETE /api/v1/compose/:name
Authorization: Bearer <token>
```

### 启动项目

```
POST /api/v1/compose/:name/up
Authorization: Bearer <token>
```

### 停止项目

```
POST /api/v1/compose/:name/down
Authorization: Bearer <token>
```

### 项目服务列表

```
GET /api/v1/compose/:name/ps
Authorization: Bearer <token>
```

**响应**:
```json
[
  { "name": "web", "state": "running", "image": "nginx:latest", "ports": "0.0.0.0:8080->80/tcp" }
]
```

### 项目日志

```
GET /api/v1/compose/:name/logs?service=web&tail=100
Authorization: Bearer <token>
```

### 转换为 Quadlet

```
GET /api/v1/compose/:name/convert
Authorization: Bearer <token>
```

**响应**:
```json
[
  {
    "filename": "web.container",
    "content": "[Unit]\nDescription=myapp - web service\n\n[Container]\nImage=nginx:latest\n...",
    "warnings": []
  }
]
```

---

## 用户设置

### 获取设置

```
GET /api/v1/settings
Authorization: Bearer <token>
```

**响应**:
```json
{
  "userId": 1,
  "language": "en",
  "theme": "dark",
  "quadletDir": "",
  "podmanSocket": "",
  "mirrorRegistry": "",
  "itemsPerPage": 20,
  "autoRefreshSeconds": 30,
  "defaultRestartPolicy": "always",
  "notifyOnFailure": true
}
```

### 更新设置

```
PUT /api/v1/settings
Authorization: Bearer <token>
```

**请求**:
```json
{
  "language": "zh",
  "quadlet_dir": "/home/user/custom-systemd",
  "mirror_registry": "docker.io",
  "items_per_page": 50
}
```

---

## 用户管理（Admin）

### 注册用户

```
POST /api/v1/auth/register
Authorization: Bearer <admin-token>
```

**请求**:
```json
{ "username": "user1", "password": "pass123", "role": "user" }
```

### 用户列表

```
GET /api/v1/auth/users
Authorization: Bearer <admin-token>
```

### 删除用户

```
DELETE /api/v1/auth/users/:id
Authorization: Bearer <admin-token>
```

### 更新用户

```
PUT /api/v1/auth/users/:id
Authorization: Bearer <admin-token>
```

**请求**:
```json
{ "role": "admin", "password": "newpass" }
```

---

## 备份

### 导出备份

```
GET /api/v1/backup/export
Authorization: Bearer <token>
```

**响应**: gzip 文件流

### 导入备份

```
POST /api/v1/backup/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求**: `backup` 文件字段（最大 50MB）

---

## 统计

### 获取统计

```
GET /api/v1/stats
Authorization: Bearer <token>
```

**响应**:
```json
{
  "containers": [
    {
      "id": "abc123",
      "name": "nginx",
      "cpuPercent": 2.5,
      "memUsage": 104857600,
      "memLimit": 1073741824,
      "netInput": 1024,
      "netOutput": 2048
    }
  ]
}
```

---

## WebSocket

### 连接

```
ws://localhost:9090/api/v1/ws?token=<jwt>
```

或使用 Header:
```
Authorization: Bearer <jwt>
```

### 接收消息格式

```json
{ "type": "stats_update", "data": { "containers": [...] } }
{ "type": "unit_failed", "data": { "name": "nginx.service" } }
```

### Exec WebSocket

```
ws://localhost:9090/api/v1/containers/:id/exec/:exec_id/ws?token=<jwt>
```

发送: 文本消息（终端输入）或 JSON resize 消息
接收: 二进制消息（终端输出）
