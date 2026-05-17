# 故障排除指南

## 启动问题

### 端口被占用

```
listen tcp :9090: bind: address already in use
```

**解决**:
```bash
# 查找占用端口的进程
ss -tlnp | grep 9090
# 或
fuser 9090/tcp

# 杀掉进程
fuser -k 9090/tcp

# 或使用不同端口
./quadlet-manager --port 9091
```

### D-Bus 连接失败

```
dbus connect (rootless=true): dial unix /run/user/1000/bus: connect: no such file or directory
```

**解决**:
```bash
# 检查 session bus
echo $DBUS_SESSION_BUS_ADDRESS

# 如果为空，检查 systemd user session
systemctl --user status

# 如果 systemd user session 未运行
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
```

### Podman Socket 不可用

```
podman socket connect: dial unix /run/user/1000/podman/podman.sock: connect: no such file or directory
```

**解决**:
```bash
# 启动 podman socket
systemctl --user start podman.socket

# 检查 socket 是否存在
ls -la /run/user/$(id -u)/podman/podman.sock

# 如果不存在，手动创建
systemctl --user enable podman.socket
```

### SQLite 数据库锁定

```
database is locked
```

**解决**:
```bash
# 检查是否有其他进程占用
fuser ~/.config/quadlet-manager/data.db

# 杀掉占用进程
fuser -k ~/.config/quadlet-manager/data.db

# 如果仍然锁定，检查 WAL 文件
ls -la ~/.config/quadlet-manager/data.db*
```

---

## 认证问题

### JWT Token 过期

```
{"error":"invalid token"}
```

**解决**:
- Token 有效期 24 小时
- 前端自动处理 401 响应并跳转登录页
- 手动清除 localStorage 重新登录

### 无法创建管理员

```
{"error":"already initialized"}
```

**解决**:
- 管理员只能创建一次
- 如需重置，删除数据库文件重新启动

### 权限不足

```
{"error":"forbidden"}
```

**解决**:
- 某些操作需要 admin 角色
- 使用管理员账号登录
- 或让管理员提升用户角色

---

## 文件管理问题

### 文件创建失败

```
{"error":"invalid file extension"}
```

**解决**:
- 文件必须以 `.container`, `.volume`, `.network`, `.pod`, `.kube`, `.image` 结尾
- 检查文件名是否包含非法字符

### 目录遍历被拦截

```
{"error":"directory traversal detected"}
```

**解决**:
- 文件名不能包含 `..`, `/`, `\`
- 文件名必须是纯文件名，不能包含路径

### 文件写入失败

```
{"error":"create dir /path: permission denied"}
```

**解决**:
```bash
# 检查目录权限
ls -la ~/.config/containers/systemd/

# 创建目录并设置权限
mkdir -p ~/.config/containers/systemd
chmod 755 ~/.config/containers/systemd
```

---

## 单元管理问题

### 单元列表为空

**可能原因**:
1. Quadlet 目录中没有文件
2. 用户设置了自定义 quadlet_dir 但目录为空
3. systemd 未识别 Quadlet 生成的单元

**排查步骤**:
```bash
# 1. 检查 Quadlet 目录
ls -la ~/.config/containers/systemd/

# 2. 手动触发 daemon-reload
systemctl --user daemon-reload

# 3. 检查生成的单元
systemctl --user list-units --type=service

# 4. 检查单元状态
systemctl --user status nginx.service
```

### 启动失败

```
{"error":"start unit nginx.service: Unit nginx.service not found"}
```

**解决**:
```bash
# 检查单元是否存在
systemctl --user cat nginx.service

# 如果不存在，可能需要 daemon-reload
systemctl --user daemon-reload

# 检查 Quadlet 文件语法
cat ~/.config/containers/systemd/nginx.container
```

---

## 前端问题

### 页面白屏

**可能原因**:
1. TypeScript 编译错误
2. API 请求失败
3. 路由配置错误

**排查步骤**:
```bash
# 1. 检查浏览器控制台错误
# 2. 检查 TypeScript 编译
cd web && npx tsc --noEmit

# 3. 检查 API 请求
# 浏览器 Network 标签页查看请求状态
```

### API 请求 401

**解决**:
- 检查 localStorage 中是否有 token
- 检查 token 是否过期
- 重新登录

### WebSocket 连接失败

**解决**:
- WebSocket 需要 JWT token（通过 query param 或 header）
- 前端自动附加 token
- 检查浏览器 Network 标签页的 WS 连接

---

## 构建问题

### 前端构建失败

```bash
# 检查 Node.js 版本
node --version  # 需要 18+

# 清理并重新安装依赖
cd web
rm -rf node_modules package-lock.json
npm install

# 检查 TypeScript 错误
npx tsc --noEmit
```

### Go 编译失败

```bash
# 检查 Go 版本
go version  # 需要 1.22+

# 清理模块缓存
go clean -modcache

# 重新下载依赖
go mod download

# 检查编译错误
go build ./...
```

### embed.FS 错误

```
pattern web/dist: no matching files found
```

**解决**:
```bash
# 先构建前端
cd web && npm run build

# 然后构建 Go
go build -o bin/quadlet-manager ./cmd/quadlet-manager
```

---

## 性能问题

### 内存占用高

**可能原因**:
- 备份导入文件过大（已限制 50MB）
- WebSocket 客户端过多
- 容器统计轮询频率过高

**解决**:
- 检查 WebSocket 连接数
- 调整统计轮询间隔

### 响应慢

**可能原因**:
- Podman Socket 连接超时
- D-Bus 调用阻塞
- SQLite 查询慢

**排查步骤**:
```bash
# 检查 Podman socket 响应
time curl --unix-socket /run/user/$(id -u)/podman/podman.sock http://localhost/v5.0.0/libpod/info

# 检查 systemd 状态
systemctl --user status
```
