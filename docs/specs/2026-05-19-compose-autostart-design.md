# Docker Compose 兼容 + 开机自启 设计文档

> 日期: 2026-05-19
> 状态: 已确认

---

## 概述

两个功能：
1. **Docker Compose 兼容** — 在容器页面导入 docker-compose.yml，用 `podman compose` 管理，调试完成后可转换为 Quadlet 文件
2. **开机自启** — Apply 文件时自动 enable，容器页面提供开机自启开关

---

## 功能 1: Docker Compose 兼容

### 后端

#### 新增 Provider 接口

**文件:** `internal/provider/compose.go`

```go
type ComposeProvider interface {
    ImportProject(ctx context.Context, name string, content string) error
    ListProjects(ctx context.Context) ([]ComposeProject, error)
    RemoveProject(ctx context.Context, name string) error

    Up(ctx context.Context, name string) error
    Down(ctx context.Context, name string) error
    Ps(ctx context.Context, name string) ([]ComposeService, error)
    Logs(ctx context.Context, name string, service string, tail int) ([]string, error)

    ConvertToQuadlet(ctx context.Context, name string) ([]QuadletConversion, error)
}
```

#### 数据模型

```go
type ComposeProject struct {
    Name     string   `json:"name"`
    File     string   `json:"file"`
    Status   string   `json:"status"`     // running / stopped / partial
    Services []string `json:"services"`
}

type ComposeService struct {
    Name  string `json:"name"`
    State string `json:"state"`
    Image string `json:"image"`
    Ports string `json:"ports"`
}

type QuadletConversion struct {
    Filename string   `json:"filename"`
    Content  string   `json:"content"`
    Warnings []string `json:"warnings"`
}
```

#### 实现: `internal/provider/compose_impl.go`

- 使用 `os/exec` 调用 `podman compose`（自动检测 `podman-compose` 或 `podman compose` 插件）
- 项目文件存储在 `{quadletDir}/.compose/{projectName}/docker-compose.yml`
- `ConvertToQuadlet` 用 `gopkg.in/yaml.v3` 解析 YAML，映射为 `QuadletConfig`，调用 `GenerateQuadletFile` 生成 INI

**Compose → Quadlet 字段映射：**

| Compose | Quadlet | 备注 |
|---------|---------|------|
| `image` | `Image=` | |
| `ports` | `PublishPort=` | |
| `volumes` | `Volume=` | 需处理 named volume |
| `environment` | `Environment=` | |
| `restart` | `Restart=` + `[Install]` | always → WantedBy |
| `user` | `User=` | |
| `hostname` | `HostName=` | |
| `networks` | `Network=` | 生成独立 .network 文件 |
| `command` | `Exec=` | |
| `healthcheck` | `HealthCmd=` 等 | 部分支持 |
| `depends_on` | `After=` | 仅顺序依赖，不支持 condition |
| `build` | — | 不支持，生成警告 |
| `deploy` | — | 不支持，生成警告 |

#### 新增 Handler

**文件:** `internal/handler/compose_handler.go`

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/v1/compose/import` | 上传 compose 文件，body: `{name, content}` |
| GET | `/api/v1/compose/projects` | 列出所有项目及状态 |
| DELETE | `/api/v1/compose/:project` | 删除项目（含 down） |
| POST | `/api/v1/compose/:project/up` | `podman compose up -d` |
| POST | `/api/v1/compose/:project/down` | `podman compose down` |
| GET | `/api/v1/compose/:project/ps` | 项目服务状态 |
| GET | `/api/v1/compose/:project/logs?service=x&tail=100` | 服务日志 |
| POST | `/api/v1/compose/:project/convert` | 转换为 Quadlet 文件（不自动 Apply） |

#### 新增依赖

- `gopkg.in/yaml.v3` — YAML 解析

### 前端

#### ContainersPage 变更

1. **顶部新增 "Import Compose" 按钮**
   - 弹窗：项目名输入 + 文件上传/粘贴 YAML
   - 提交后调用 `POST /api/v1/compose/import`

2. **Compose 项目区域**（容器列表上方）
   - 每个项目显示为可折叠卡片
   - 卡片头：项目名 + Status badge + 操作按钮（Up / Down / Convert）
   - 展开后：该项目的 services 表格（Name / State / Image / Ports）
   - Logs 按钮展开日志面板

3. **转换流程**
   - 点击 "Convert to Quadlet" → 调用 API → 返回生成的文件列表
   - 弹窗显示：每个文件的预览 + 警告列表
   - 用户确认后写入文件（调用已有的 createFile API）

#### 新增文件

| 文件 | 说明 |
|------|------|
| `web/src/hooks/useCompose.ts` | React Query hooks: useComposeProjects, useComposeImport, useComposeUp, useComposeDown, useComposePs, useComposeLogs, useComposeConvert |
| `web/src/components/compose/ComposeProjectCard.tsx` | 项目卡片组件 |
| `web/src/components/compose/ImportComposeDialog.tsx` | 导入弹窗 |
| `web/src/components/compose/ConvertPreviewDialog.tsx` | 转换预览弹窗 |

#### API Client 新增

`web/src/api/client.ts` 新增：

```typescript
// Compose
importCompose: (name: string, content: string) =>
    request('/compose/import', { method: 'POST', body: JSON.stringify({ name, content }) }),
listComposeProjects: () => request<ComposeProject[]>('/compose/projects'),
removeComposeProject: (project: string) =>
    request(`/compose/${project}`, { method: 'DELETE' }),
composeUp: (project: string) =>
    request(`/compose/${project}/up`, { method: 'POST' }),
composeDown: (project: string) =>
    request(`/compose/${project}/down`, { method: 'POST' }),
composePs: (project: string) =>
    request<ComposeService[]>(`/compose/${project}/ps`),
composeLogs: (project: string, service: string, tail = 100) =>
    request<{logs: string[]}>(`/compose/${project}/logs?service=${service}&tail=${tail}`),
composeConvert: (project: string) =>
    request<QuadletConversion[]>(`/compose/${project}/convert`, { method: 'POST' }),
```

#### i18n 新增

`compose.import`, `compose.projectName`, `compose.up`, `compose.down`, `compose.convert`, `compose.convertTitle`, `compose.noProjects`, `compose.status.running`, `compose.status.stopped`, `compose.status.partial`, `compose.warnings`

---

## 功能 2: 开机自启

### 后端变更

#### 1. ApplyFile 自动 Enable

**文件:** `internal/service/file_service.go`

`ApplyFile` 方法在 `StartUnit` 之后追加 `EnableUnit`：

```go
func (s *FileService) ApplyFile(ctx context.Context, userID int64, filename string, content string) error {
    // 1. Write file
    if err := s.WriteFile(ctx, userID, filename, content); err != nil {
        return err
    }
    unitName := filenameToUnitName(filename)

    // 2. Daemon reload
    if err := s.systemd.DaemonReload(ctx); err != nil {
        return fmt.Errorf("daemon reload: %w", err)
    }

    // 3. Start unit
    if err := s.systemd.StartUnit(ctx, unitName); err != nil {
        return fmt.Errorf("start unit: %w", err)
    }

    // 4. Enable unit (auto-start on boot)
    _ = s.systemd.EnableUnit(ctx, unitName) // best-effort, 不阻塞

    return nil
}
```

#### 2. 容器自动启 API

**文件:** `internal/handler/container_handler.go`

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/v1/containers/:id/autostart` | 查询是否 enabled（inspect label 获取 unit name → systemctl is-enabled） |
| POST | `/api/v1/containers/:id/autostart` | 切换，body: `{enabled: true/false}` |

**实现逻辑：**
1. Inspect 容器获取 `io.containers.systemd.unit` label
2. 如果没有该 label，返回 400（非 Quadlet 管理）
3. 有 label 时，调用 `systemd.EnableUnit` 或 `systemd.DisableUnit`

### 前端变更

#### ContainersPage 自启开关

- Quadlet 管理的容器（通过 API 返回的 `managed` 字段识别）显示 Toggle 开关
- 开关状态通过 `GET /api/v1/containers/:id/autostart` 获取
- 点击调用 `POST /api/v1/containers/:id/autostart`

#### API Client 新增

```typescript
getContainerAutostart: (id: string) =>
    request<{enabled: boolean}>(`/containers/${id}/autostart`),
setContainerAutostart: (id: string, enabled: boolean) =>
    request(`/containers/${id}/autostart`, { method: 'POST', body: JSON.stringify({ enabled }) }),
```

#### i18n 新增

`containers.autostart`, `containers.autostartOn`, `containers.autostartOff`

---

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `internal/provider/compose.go` | ComposeProvider 接口定义 |
| `internal/provider/compose_impl.go` | os/exec 实现 |
| `internal/provider/compose_test.go` | 测试 |
| `internal/handler/compose_handler.go` | Compose HTTP handler |
| `web/src/hooks/useCompose.ts` | React Query hooks |
| `web/src/components/compose/ComposeProjectCard.tsx` | 项目卡片 |
| `web/src/components/compose/ImportComposeDialog.tsx` | 导入弹窗 |
| `web/src/components/compose/ConvertPreviewDialog.tsx` | 转换预览 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `internal/service/file_service.go` | ApplyFile 追加 EnableUnit |
| `internal/handler/container_handler.go` | 新增 autostart 接口 |
| `cmd/quadlet-manager/main.go` | 注册 compose 和 autostart 路由，初始化 ComposeProvider |
| `web/src/api/client.ts` | 新增 compose + autostart API 方法和类型 |
| `web/src/pages/ContainersPage.tsx` | 集成 Compose 项目区域 + 自启开关 |
| `web/src/i18n/en.json` | 新增 compose.* 和 autostart 翻译 |
| `web/src/i18n/zh.json` | 新增 compose.* 和 autostart 翻译 |
| `go.mod` | 新增 gopkg.in/yaml.v3 依赖 |

---

## 实施顺序

1. **开机自启**（改动小，独立）
   - ApplyFile 自动 enable
   - 容器 autostart API
   - 前端 toggle 开关

2. **Compose 后端**
   - ComposeProvider 接口 + 实现
   - ComposeHandler
   - 路由注册

3. **Compose 前端**
   - API client + hooks
   - 导入弹窗
   - 项目卡片
   - 转换预览

4. **集成测试 + i18n**
