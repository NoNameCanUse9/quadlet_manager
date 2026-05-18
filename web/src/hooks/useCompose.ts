import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useComposeProjects() {
  return useQuery({
    queryKey: ['compose-projects'],
    queryFn: api.listComposeProjects,
    refetchInterval: 10_000,
  })
}

export function useImportComposeProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      api.importComposeProject(name, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useRemoveComposeProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.removeComposeProject(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useComposeUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.composeUp(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useComposeDown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.composeDown(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compose-projects'] }),
  })
}

export function useConvertCompose() {
  return useMutation({
    mutationFn: (name: string) => api.convertCompose(name),
  })
}
