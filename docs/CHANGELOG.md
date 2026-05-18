# 变更日志

## 2026-05-19 — Quadlet 编排中心大一统 + Docker Compose UI 支持 + 文件后缀选择器

### 新增
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
