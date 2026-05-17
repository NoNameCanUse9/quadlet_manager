import { create } from 'zustand'
import { api, type SystemInfo, type QuadletFile } from '@/api/client'

interface AppState {
  systemInfo: SystemInfo | null
  files: QuadletFile[]
  selectedFile: string | null
  loading: boolean
  fetchSystemInfo: () => Promise<void>
  fetchFiles: () => Promise<void>
  selectFile: (name: string | null) => void
}

export const useApp = create<AppState>((set) => ({
  systemInfo: null,
  files: [],
  selectedFile: null,
  loading: false,

  fetchSystemInfo: async () => {
    try {
      const info = await api.getSystemInfo()
      set({ systemInfo: info })
    } catch {
      // non-critical
    }
  },

  fetchFiles: async () => {
    set({ loading: true })
    try {
      const files = await api.listFiles()
      set({ files, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  selectFile: (name) => set({ selectedFile: name }),
}))
