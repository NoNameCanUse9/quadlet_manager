import { create } from 'zustand'
import { api, type UnitStatus } from '@/api/client'

interface UnitsState {
  units: UnitStatus[]
  loading: boolean
  error: string | null
  fetchUnits: () => Promise<void>
  startUnit: (name: string) => Promise<void>
  stopUnit: (name: string) => Promise<void>
  restartUnit: (name: string) => Promise<void>
  enableUnit: (name: string) => Promise<void>
  disableUnit: (name: string) => Promise<void>
  daemonReload: () => Promise<void>
}

export const useUnits = create<UnitsState>((set, get) => ({
  units: [],
  loading: false,
  error: null,

  fetchUnits: async () => {
    set({ loading: true, error: null })
    try {
      const units = await api.listUnits()
      set({ units, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  startUnit: async (name) => {
    await api.startUnit(name)
    await get().fetchUnits()
  },
  stopUnit: async (name) => {
    await api.stopUnit(name)
    await get().fetchUnits()
  },
  restartUnit: async (name) => {
    await api.restartUnit(name)
    await get().fetchUnits()
  },
  enableUnit: async (name) => {
    await api.enableUnit(name)
    await get().fetchUnits()
  },
  disableUnit: async (name) => {
    await api.disableUnit(name)
    await get().fetchUnits()
  },
  daemonReload: async () => {
    await api.daemonReload()
    await get().fetchUnits()
  },
}))
