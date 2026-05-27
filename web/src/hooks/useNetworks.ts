import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: api.listNetworks,
    refetchInterval: 30_000,
  })
}

export function useCreateNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, driver, subnet }: { name: string; driver?: string; subnet?: string }) =>
      api.createNetwork(name, driver, subnet),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}

export function useRemoveNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.removeNetwork(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}

export function useConnectNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, containerId }: { name: string; containerId: string }) =>
      api.connectNetwork(name, containerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}

export function useDisconnectNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, containerId, force }: { name: string; containerId: string; force?: boolean }) =>
      api.disconnectNetwork(name, containerId, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}

export function usePruneNetworks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.pruneNetworks(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['networks'] }),
  })
}
