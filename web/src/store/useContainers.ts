import { create } from 'zustand'
import { api, type ContainerInfo, type ContainerStats } from '@/api/client'

interface ContainersState {
  containers: ContainerInfo[]
  stats: ContainerStats[]
  loading: boolean
  error: string | null
  fetchContainers: () => Promise<void>
  fetchStats: () => Promise<void>
}

export const useContainers = create<ContainersState>((set) => ({
  containers: [],
  stats: [],
  loading: false,
  error: null,

  fetchContainers: async () => {
    set({ loading: true, error: null })
    try {
      const containers = await api.listContainers()
      set({ containers, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchStats: async () => {
    try {
      const data = await api.getStats()
      set({ stats: data.containers })
    } catch {
      // stats are non-critical
    }
  },
}))
