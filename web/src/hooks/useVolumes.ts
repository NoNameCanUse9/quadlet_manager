import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useVolumes() {
  return useQuery({
    queryKey: ['volumes'],
    queryFn: api.listVolumes,
    refetchInterval: 30_000,
  })
}

export function useCreateVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, labels }: { name: string; labels?: Record<string, string> }) =>
      api.createVolume(name, labels),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volumes'] }),
  })
}

export function useRemoveVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) => api.removeVolume(name, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volumes'] }),
  })
}
