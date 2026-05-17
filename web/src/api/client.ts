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
  listImages: () => request<ImageInfo[]>('/containers/images'),
  listVolumes: () => request<VolumeInfo[]>('/containers/volumes'),
  listNetworks: () => request<NetworkInfo[]>('/containers/networks'),

  // Stats
  getStats: () => request<SystemStats>('/stats'),
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

export interface SystemStats {
  containers: ContainerStats[]
}
