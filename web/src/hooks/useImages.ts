import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useImages() {
  return useQuery({
    queryKey: ['images'],
    queryFn: api.listImages,
    refetchInterval: 30_000,
  })
}

export function usePullImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.pullImage(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['images'] }),
  })
}

export function useRemoveImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.removeImage(id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['images'] }),
  })
}
