import { useAuth } from '@/store/useAuth'

const BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  })
  if (res.status === 401) {
    useAuth.getState().logout()
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  request,
  // System
  getSystemInfo: () => request<SystemInfo>('/system/info'),

  // Units
  listUnits: () => request<UnitStatus[]>('/units'),
  getUnit: (name: string) => request<UnitStatus>(`/units/${name}`),
  startUnit: (name: string) => request(`/units/${name}/start`, { method: 'POST' }),
  stopUnit: (name: string) => request(`/units/${name}/stop`, { method: 'POST' }),
  restartUnit: (name: string) => request(`/units/${name}/restart`, { method: 'POST' }),
  enableUnit: (name: string) => request(`/units/${name}/enable`, { method: 'POST' }),
  disableUnit: (name: string) => request(`/units/${name}/disable`, { method: 'POST' }),
  daemonReload: () => request('/daemon/reload', { method: 'POST' }),

  // Files
  listFiles: () => request<QuadletFile[]>('/files'),
  readFile: (filename: string) => request<FileContent>(`/files/${filename}`),
  createFile: (filename: string, content: string) =>
    request('/files', { method: 'POST', body: JSON.stringify({ filename, content }) }),
  updateFile: (filename: string, content: string) =>
    request(`/files/${filename}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteFile: (filename: string) =>
    request(`/files/${filename}`, { method: 'DELETE' }),
  applyFile: (filename: string, content: string) =>
    request(`/files/${filename}/apply`, { method: 'POST', body: JSON.stringify({ content }) }),
  validateFile: (content: string) =>
    request<ValidateResult>('/files/validate', { method: 'POST', body: JSON.stringify({ content }) }),

  // Containers
  listContainers: () => request<ContainerInfo[]>('/containers'),
  getContainerLogs: (id: string, tail = 100) =>
    request<ContainerLogs>(`/containers/${id}/logs?tail=${tail}`),
  startContainer: (id: string) => request(`/containers/${id}/start`, { method: 'POST' }),
  stopContainer: (id: string) => request(`/containers/${id}/stop`, { method: 'POST' }),
  restartContainer: (id: string) => request(`/containers/${id}/restart`, { method: 'POST' }),
  pauseContainer: (id: string) => request(`/containers/${id}/pause`, { method: 'POST' }),
  unpauseContainer: (id: string) => request(`/containers/${id}/unpause`, { method: 'POST' }),
  removeContainer: (id: string, force = false) =>
    request(`/containers/${id}?force=${force}`, { method: 'DELETE' }),
  inspectContainer: (id: string) => request<ContainerInspect>(`/containers/${id}/inspect`),
  getAutostart: (id: string) => request<{ enabled: boolean }>(`/containers/${id}/autostart`),
  setAutostart: (id: string, enabled: boolean) =>
    request(`/containers/${id}/autostart`, { method: 'POST', body: JSON.stringify({ enabled }) }),

  // Exec
  execCreate: (id: string, cmd: string[] = ['/bin/sh']) =>
    request<{ exec_id: string }>(`/containers/${id}/exec`, { method: 'POST', body: JSON.stringify({ cmd }) }),

  // Images
  listImages: () => request<ImageInfo[]>('/images'),
  pullImage: (name: string) =>
    request<{ task_id: string }>('/images/pull', { method: 'POST', body: JSON.stringify({ name }) }),
  removeImage: (id: string, force = false) =>
    request(`/images/${id}?force=${force}`, { method: 'DELETE' }),
  inspectImage: (id: string) => request<ImageInspect>(`/images/${id}/inspect`),

  // Volumes
  listVolumes: () => request<VolumeInfo[]>('/volumes'),
  createVolume: (name: string, labels?: Record<string, string>) =>
    request('/volumes', { method: 'POST', body: JSON.stringify({ name, labels }) }),
  removeVolume: (name: string, force = false) =>
    request(`/volumes/${name}?force=${force}`, { method: 'DELETE' }),
  inspectVolume: (name: string) => request<VolumeInspect>(`/volumes/${name}/inspect`),

  // Networks
  listNetworks: () => request<NetworkInfo[]>('/networks'),
  createNetwork: (name: string, driver?: string, subnet?: string) =>
    request('/networks', { method: 'POST', body: JSON.stringify({ name, driver, subnet }) }),
  removeNetwork: (name: string) =>
    request(`/networks/${name}`, { method: 'DELETE' }),
  inspectNetwork: (name: string) => request<NetworkInspect>(`/networks/${name}/inspect`),

  // Compose
  listComposeProjects: () => request<ComposeProject[]>('/compose'),
  importComposeProject: (name: string, content: string, dir?: string) =>
    request('/compose/import', { method: 'POST', body: JSON.stringify({ name, content, dir: dir || '' }) }),
  removeComposeProject: (name: string) =>
    request(`/compose/${name}`, { method: 'DELETE' }),
  composeUp: (name: string) =>
    request(`/compose/${name}/up`, { method: 'POST' }),
  composeDown: (name: string) =>
    request(`/compose/${name}/down`, { method: 'POST' }),
  composePs: (name: string) =>
    request<ComposeService[]>(`/compose/${name}/ps`),
  composeLogs: (name: string, service?: string, tail = 100) => {
    const params = new URLSearchParams()
    if (service) params.set('service', service)
    if (tail) params.set('tail', String(tail))
    return request<string[]>(`/compose/${name}/logs?${params}`)
  },
  convertCompose: (name: string) =>
    request<QuadletConversion[]>(`/compose/${name}/convert`),

  // Backup
  exportBackup: () => {
    const token = useAuth.getState().token
    return fetch(`${BASE}/backup/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(res => res.blob())
  },
  importBackup: (file: File) => {
    const token = useAuth.getState().token
    const formData = new FormData()
    formData.append('backup', file)
    return fetch(`${BASE}/backup/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(res => res.json())
  },

  // Stats
  getStats: () => request<SystemStats>('/stats'),

  // Settings
  getSettings: () => request<UserSettings>('/settings'),
  updateSettings: (fields: Record<string, unknown>) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(fields) }),
}

export interface SystemInfo {
  port: number
  rootless: boolean
  quadletDir: string
}

export interface UnitStatus {
  name: string
  description: string
  loadState: string
  activeState: string
  subState: string
  sourcePath: string
}

export interface QuadletFile {
  name: string
  path: string
  content: string
  modTime: string
  type: string
}

export interface FileContent {
  filename: string
  content: string
}

export interface ValidateResult {
  valid: boolean
  warnings?: string[]
  error?: string
}

export interface ContainerInfo {
  id: string
  names: string[]
  image: string
  state: string
  status: string
  labels?: Record<string, string>
}

export interface ContainerStats {
  id: string
  name: string
  cpuPercent: number
  memUsage: number
  memLimit: number
  netInput: number
  netOutput: number
}

export interface ContainerLogs {
  id: string
  logs: string[]
}

export interface ImageInfo {
  id: string
  tags: string[]
  size: number
}

export interface VolumeInfo {
  name: string
  mountPoint: string
}

export interface NetworkInfo {
  name: string
  id: string
}

export interface ContainerInspect {
  id: string
  name: string
  state: {
    status: string
    running: boolean
    paused: boolean
  }
  config: {
    image: string
    cmd: string[]
    env: string[]
  }
  labels: Record<string, string>
}

export interface ImageInspect {
  id: string
  repoTags: string[]
  size: number
  created: string
}

export interface VolumeInspect {
  name: string
  mountpoint: string
  labels: Record<string, string>
  driver: string
  createdAt: string
}

export interface NetworkInspect {
  name: string
  id: string
  driver: string
  subnet: string
  gateway: string
}

export interface SystemStats {
  containers: ContainerStats[]
}

export interface UserSettings {
  user_id: number
  language: string
  theme: string
  quadlet_dir: string
  podman_socket: string
  items_per_page: number
  auto_refresh_seconds: number
  default_restart_policy: string
  notify_on_failure: boolean
}

export interface ComposeProject {
  name: string
  file: string
  status: string
  services: string[]
}

export interface ComposeService {
  name: string
  state: string
  image: string
  ports: string
}

export interface QuadletConversion {
  filename: string
  content: string
  warnings: string[]
}
