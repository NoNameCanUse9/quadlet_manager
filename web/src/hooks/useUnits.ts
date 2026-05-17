import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: api.listUnits,
    refetchInterval: 10_000,
  })
}

export function useStartUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.startUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useStopUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.stopUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useRestartUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.restartUnit(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}

export function useDaemonReload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.daemonReload(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  })
}
