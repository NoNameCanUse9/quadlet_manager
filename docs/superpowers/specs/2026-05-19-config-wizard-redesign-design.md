# ConfigWizard 结构化重设计 — Phase 1 设计文档

> 将扁平表单重构为 Tabs 分组 + 左右分栏布局，支持 Unit 依赖、AutoUpdate、实时代码预览。

---

## 1. 背景与动机

当前 `ConfigWizard` 是一个单一流式扁平表单，仅覆盖 `[Container]` 的基础字段和 `[Service]` 的 Restart。对于生产级 Quadlet 配置（依赖管理、健康检查、生命周期钩子、自动更新），现有结构无法扩展。

用户需要：
- 按 Quadlet INI section 分组的 Tab 界面
- Unit 依赖管理（After/Requires/Wants）
- AutoUpdate 开关联动
- 实时代码预览（左右分栏）
- 结构化的端口/卷/环境变量编辑（对象数组替代字符串数组）

## 2. 范围

### Phase 1（本文档）

| 模块 | 内容 |
|------|------|
| 数据模型 | 分段嵌套 WizardData + 结构化端口/卷/环境变量 + 联合类型 |
| shadcn 组件 | tabs, switch, accordion, badge |
| UI 布局 | 左右分栏（60/40）+ 3 个 Tab + Tab1 内 Accordion 折叠 |
| 交互 | Chip 行内编辑 + Tab 红点校验指示 + AutoUpdate 预览高亮 |
| 转换逻辑 | wizardToQuadlet / quadletToWizard 按 section 重写 |
| 预览面板 | 右侧固定，实时 INI 高亮 |
| 依赖补全 | Tab 2 输入框调用后端 API 获取已有服务列表 |
| i18n | 中英文翻译补全 |
| 迁移 | FilesPage + CreateContainerDialog 适配新接口 |

### Phase 2（预留）

- HealthCheck UI（数据模型已预留 `healthCheck` 字段）
- ExecStartPre/Post UI（数据模型已预留 `execStartPre`/`execStartPost` 字段）
- waitForPaths UI + 动态脚本生成（数据模型已预留 `waitForPaths` 字段）
- "等待挂载点"专用表单项，自动生成 `until [ -d ... ]` 脚本

## 3. 数据模型

### 3.1 结构化子类型

```typescript
// web/src/components/wizard/types.ts

/** 端口映射 */
export interface PortMapping {
  hostPort: string
  containerPort: string
  protocol: 'tcp' | 'udp'
}

/** 卷挂载 */
export interface VolumeMount {
  hostPath: string
  containerPath: string
  mode: 'rw' | 'ro'
}

/** 环境变量 */
export interface EnvVar {
  key: string
  value: string
}

/** 健康检查配置（Phase 2 实现 UI） */
export interface HealthCheckConfig {
  enabled: boolean
  cmd: string
  interval: string     // e.g. "10s"
  retries: number
  startPeriod: string  // e.g. "30s"
  timeout: string      // e.g. "5s"
}
```

### 3.2 WizardData 分段结构

```typescript
export interface ContainerData {
  // 现有字段
  image: string
  exec: string
  ports: PortMapping[]
  volumes: VolumeMount[]
  env: EnvVar[]
  labels: Record<string, string>
  user: string
  group: string
  hostName: string
  network: string
  // Phase 1 新增
  autoUpdate: 'registry' | 'local' | ''
  // Phase 2 预留
  healthCheck: HealthCheckConfig
}

export interface UnitData {
  description: string
  after: string[]      // 弱排序依赖
  requires: string[]   // 强依赖（依赖失败则本服务也失败）
  wants: string[]      // 弱依赖（依赖失败不影响本服务）
}

export interface ServiceData {
  restart: 'always' | 'on-failure' | 'no' | 'unless-stopped'
  timeoutStartSec: string
  // Phase 2 预留
  waitForPaths: string[]    // 等待路径可用，Phase 2 生成 until [ -d ... ] 脚本
  execStartPre: string[]
  execStartPost: string[]
}

export interface WizardData {
  container: ContainerData
  unit: UnitData
  service: ServiceData
}
```

### 3.3 默认值

```typescript
export const defaultWizardData: WizardData = {
  container: {
    image: '',
    exec: '',
    ports: [],
    volumes: [],
    env: [],
    labels: {},
    user: '',
    group: '',
    hostName: '',
    network: '',
    autoUpdate: '',
    healthCheck: {
      enabled: false,
      cmd: '',
      interval: '10s',
      retries: 3,
      startPeriod: '30s',
      timeout: '5s',
    },
  },
  unit: {
    description: '',
    after: [],
    requires: [],
    wants: [],
  },
  service: {
    restart: 'always',
    timeoutStartSec: '300',
    waitForPaths: [],
    execStartPre: [],
    execStartPost: [],
  },
}
```

## 4. UI 结构

### 4.1 布局：左右分栏

```
┌──────────────────────────────────────────────────────────────┐
│  ConfigWizard (Split View)                                   │
├────────────────────────┬─────────────────────────────────────┤
│  Left Panel (60%)      │  Right Panel (40%)                  │
│                        │                                     │
│  ┌──────────────────┐  │  ┌───────────────────────────────┐  │
│  │ [常规] [依赖] [服务] │  │  ▾ 代码预览                    │  │
│  ├──────────────────┤  │  │ [Unit]                        │  │
│  │                  │  │  │ Description=my-app container  │  │
│  │  Tab content...  │  │  │ After=rclone.service          │  │
│  │                  │  │  │                               │  │
│  │                  │  │  │ [Container]                   │  │
│  │                  │  │  │ Image=nginx:latest            │  │
│  │                  │  │  │ PublishPort=8080:80/tcp       │  │
│  │                  │  │  │ AutoUpdate=registry           │  │
│  │                  │  │  │ Label=io.containers...        │  │
│  │                  │  │  │                               │  │
│  │                  │  │  │ [Service]                     │  │
│  │                  │  │  │ Restart=always                │  │
│  │                  │  │  │ TimeoutStartSec=300           │  │
│  │                  │  │  │                               │  │
│  │                  │  │  │ [Install]                     │  │
│  │                  │  │  │ WantedBy=default.target       │  │
│  └──────────────────┘  │  └───────────────────────────────┘  │
└────────────────────────┴─────────────────────────────────────┘
```

- 左侧可独立滚动
- 右侧固定，独立滚动
- 响应式：窄屏（< 768px）切换为上下布局

### 4.2 Tab 1: 常规配置（Container section）

使用 Accordion 折叠面板分组：

| 面板 | 默认状态 | 字段 |
|------|----------|------|
| 镜像 & 命令 | 展开 | image, exec |
| 端口映射 | 展开 | ports: PortMapping[] (Chip 行内编辑) |
| 卷挂载 | 折叠 | volumes: VolumeMount[] (Chip 行内编辑) |
| 环境变量 | 折叠 | env: EnvVar[] (Chip 行内编辑) |
| 网络 & 用户 | 折叠 | network, hostName, user, group |
| 标签 | 折叠 | labels: Record<string, string> |
| 自动更新 | 折叠 | autoUpdate: Switch + 下拉 |

**Chip 行内编辑交互**：
- 默认显示为 Chip（如 `8080:80/tcp`）
- 点击 Chip → 展开为多个输入框（hostPort, containerPort, protocol）
- 失焦或按 Enter → 自动保存，恢复为 Chip
- 新增项直接显示为输入框
- 失焦时若所有字段为空 → 删除该项；若部分填满 → 保留已填字段（端口默认 tcp，卷默认 rw）

**AutoUpdate 联动**：
- Switch 开启时显示下拉（registry/local）
- 选择 registry 时，代码预览中高亮自动生成的 `Label=io.containers.autoupdate=registry`

### 4.3 Tab 2: Unit 依赖

| 字段 | 组件 | 说明 |
|------|------|------|
| 描述 | Input | 填入 [Unit] Description= |
| After | MultiInput + 自动补全 | 弱排序依赖，多个值空格分隔 |
| Requires | MultiInput + 自动补全 | 强依赖 |
| Wants | MultiInput + 自动补全 | 弱依赖 |

**自动补全**：调用 `GET /api/v1/units` 获取已有服务列表，输入时过滤建议。

### 4.4 Tab 3: 服务配置（Service section）

| 字段 | 组件 | 说明 |
|------|------|------|
| 重启策略 | Select | always / on-failure / no / unless-stopped |
| 启动超时 | Number Input | 填入 TimeoutStartSec=，单位秒 |
| waitForPaths | MultiInput（Phase 2 UI） | Phase 1 存数据，Phase 2 生成脚本 |

### 4.5 Tab 校验指示器

Tab 标题右侧显示状态点：
- 红点：必填项未填（如 Tab 1 的 image 为空）
- 无点：所有必填项已填

### 4.6 实时代码预览

- 使用 `<pre>` + 语法高亮（INI 关键字着色）
- `wizardToQuadlet` 实时生成
- AutoUpdate 联动的 Label 行高亮显示

## 5. 转换逻辑

### 5.1 wizardToQuadlet(data: WizardData): string

按 section 顺序生成：

1. `[Unit]` — description, after, requires, wants
2. `[Container]` — image, exec, ports, volumes, env, labels, autoUpdate + 联动 label, user, group, hostName, network
3. `[Service]` — restart, timeoutStartSec
4. `[Install]` — WantedBy=default.target（硬编码）

**Description fallback**：`unit.description` 为空时，使用 `container.image` 的镜像名（不含 tag）作为 Description。如 `docker.io/nginx:latest` → `Description=nginx container`。

**AutoUpdate 联动**：当 `container.autoUpdate === 'registry'` 时，自动追加 `Label=io.containers.autoupdate=registry`。

**端口格式化**：`{ hostPort: '8080', containerPort: '80', protocol: 'tcp' }` → `PublishPort=8080:80/tcp`

**卷格式化**：`{ hostPath: '/data', containerPath: '/app/data', mode: 'ro' }` → `Volume=/data:/app/data:ro`

### 5.2 quadletToWizard(content: string): WizardData

逐行解析 INI，按 section 分发：

- `PublishPort=8080:80/tcp` → `{ hostPort: '8080', containerPort: '80', protocol: 'tcp' }`
- `Volume=/host:/container:ro` → `{ hostPath: '/host', containerPath: '/container', mode: 'ro' }`
- `Environment=KEY=VALUE` → `{ key: 'KEY', value: 'VALUE' }`
- `Label=key=value` → `labels[key] = value`
- `Label=io.containers.autoupdate=registry` → 解析到 labels，同时设置 `autoUpdate = 'registry'`，然后从 labels 中移除该条目
- `After=svc1 svc2` → `['svc1', 'svc2']`（空格分隔）

## 6. 文件结构

```
web/src/components/wizard/
├── types.ts              # WizardData, PortMapping, VolumeMount, EnvVar 等类型定义
├── defaults.ts           # defaultWizardData 默认值
├── convert.ts            # wizardToQuadlet, quadletToWizard
├── ConfigWizard.tsx       # 主容器：左右分栏 + Tabs
├── CodePreview.tsx        # 右侧实时代码预览面板
├── panels/
│   ├── GeneralPanel.tsx   # Tab 1: 常规配置（Accordion 包裹）
│   ├── UnitPanel.tsx      # Tab 2: Unit 依赖
│   └── ServicePanel.tsx   # Tab 3: 服务配置
└── shared/
    ├── ChipInput.tsx      # Chip 行内编辑组件（替代原 MultiInput）
    └── KeyValueInput.tsx  # Key-Value 对输入组件（用于 labels, env）
```

## 7. shadcn 组件

需要通过 `npx shadcn@latest add` 安装：

| 组件 | 用途 | 已有依赖 |
|------|------|----------|
| tabs | 3 个 Tab 切换 | @radix-ui/react-tabs |
| switch | AutoUpdate 开关 | @radix-ui/react-switch |
| accordion | Tab 1 内折叠面板 | 需安装 @radix-ui/react-accordion |
| badge | Chips 展示 | 无额外依赖 |

## 8. 调用点迁移

### 8.1 FilesPage.tsx

```typescript
// 旧
wizardToQuadlet(data, selectedFile?.replace(/\.[^.]+$/, '') || 'container')
quadletToWizard(content)

// 新
wizardToQuadlet(data)  // unit.description 已包含名称
quadletToWizard(content)  // 返回新的 WizardData 结构
```

### 8.2 CreateContainerDialog.tsx

```typescript
// 旧
const initialData: WizardData = { image: '', exec: '', ports: [], ... }

// 新
const initialData: WizardData = { ...defaultWizardData }
// 创建时设置 unit.description = name
```

## 9. i18n 新增 key

```json
{
  "wizard": {
    "tabs": {
      "general": "常规配置",
      "unit": "Unit 依赖",
      "service": "服务配置"
    },
    "autoUpdate": "自动更新",
    "autoUpdateRegistry": "Registry（自动拉取新镜像）",
    "autoUpdateLocal": "Local（本地检测变更）",
    "description": "服务描述",
    "after": "启动后依赖（After）",
    "requires": "强依赖（Requires）",
    "wants": "弱依赖（Wants）",
    "timeoutStartSec": "启动超时（秒）",
    "codePreview": "代码预览",
    "hostPort": "主机端口",
    "containerPort": "容器端口",
    "protocol": "协议",
    "hostPath": "主机路径",
    "containerPath": "容器路径",
    "mode": "模式",
    "key": "键",
    "value": "值"
  }
}
```

## 10. 后端 API 补全

Tab 2 的依赖输入需要获取已有服务列表。复用现有端点：

```
GET /api/v1/units → [{ name: "nginx.service", ... }]
```

前端提取 `name` 字段用于自动补全。

## 11. 验收标准

- [ ] ConfigWizard 显示为左右分栏布局
- [ ] 3 个 Tab 正确切换，Tab 1 内有 Accordion 折叠面板
- [ ] 端口/卷/环境变量使用结构化对象，Chip 行内编辑
- [ ] AutoUpdate Switch 开启后代码预览高亮联动 Label
- [ ] Tab 标题显示必填项校验红点
- [ ] 依赖输入框有服务名自动补全
- [ ] wizardToQuadlet 生成正确的 INI（含 AutoUpdate 联动）
- [ ] quadletToWizard 正确解析回结构化数据
- [ ] FilesPage 和 CreateContainerDialog 正常工作
- [ ] 中英文 i18n 完整
- [ ] 窄屏响应式切换为上下布局
- [ ] 所有现有测试通过
