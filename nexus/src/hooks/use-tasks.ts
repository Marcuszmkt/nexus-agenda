import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fetchTasks, type Task } from '@/lib/tasks'

export function useTasks() {
  const qc = useQueryClient()
  const query = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: fetchTasks })
  useEffect(() => {
    const ch = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return query
}
