import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useContainers() {
  return useQuery({
    queryKey: ['containers'],
    queryFn: api.listContainers,
    refetchInterval: 10_000,
  })
}

export function useContainerStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 3_000,
  })
}

export function useStartContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.startContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useStopContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.stopContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useRestartContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.restartContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function usePauseContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.pauseContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useRemoveContainer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.removeContainer(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['containers'] }),
  })
}

export function useExecCreate() {
  return useMutation({
    mutationFn: (id: string) => api.execCreate(id),
  })
}

export function useAutostart(id: string) {
  return useQuery({
    queryKey: ['autostart', id],
    queryFn: () => api.getAutostart(id),
  })
}

export function useSetAutostart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.setAutostart(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autostart'] }),
  })
}
