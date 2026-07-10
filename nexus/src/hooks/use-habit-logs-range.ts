import { useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'
import { fetchHabitLogsRange, type HabitLog } from '@/lib/habits'

export function useHabitLogsRange(from: string, to: string) {
  const id = useId()

  useEffect(() => {
    const channel = supabase
      .channel(`habit-logs-range-changes-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  return useQuery<HabitLog[]>({
    queryKey: ['habit-logs', 'range', from, to],
    queryFn: () => fetchHabitLogsRange(from, to),
  })
}
