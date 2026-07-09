import { useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'
import { fetchHabits, type Habit } from '@/lib/habits'

export function useHabits() {
  const id = useId()

  useEffect(() => {
    // Unique channel name per instance: this hook mounts on both the home page and
    // the streak page, and Supabase reuses a channel when the topic name matches,
    // which throws when .on() is called on a channel that's already subscribed.
    const channel = supabase
      .channel(`habits-changes-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, () => {
        queryClient.invalidateQueries({ queryKey: ['habits'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  return useQuery<Habit[]>({ queryKey: ['habits'], queryFn: fetchHabits })
}
