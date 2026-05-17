# 变更日志

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
