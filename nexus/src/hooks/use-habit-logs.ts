import { useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'
import { fetchHabitLogs, type HabitLog } from '@/lib/habits'

export function useHabitLogs(year: number, month: number) {
  const id = useId()

  useEffect(() => {
    // Channel name must be unique per hook instance — this page mounts useHabitLogs
    // more than once (stats month + calendar month), and Supabase reuses a channel
    // when the topic name matches, which throws when .on() is called on a channel
    // that's already subscribed.
    const channel = supabase
      .channel(`habit-logs-changes-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  return useQuery<HabitLog[]>({
    queryKey: ['habit-logs', year, month],
    queryFn: () => fetchHabitLogs(month, year),
  })
}
