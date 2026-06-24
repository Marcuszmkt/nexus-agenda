import { useQuery } from '@tanstack/react-query'
import { fetchTasks, type Task } from '@/lib/tasks'

export function useTasks() {
  return useQuery<Task[]>({ queryKey: ['tasks'], queryFn: fetchTasks })
}
