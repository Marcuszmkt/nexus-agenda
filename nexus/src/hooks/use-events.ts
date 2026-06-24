import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fetchEvents, type CalendarEvent } from '@/lib/events'

export function useEvents() {
  const qc = useQueryClient()
  const query = useQuery<CalendarEvent[]>({ queryKey: ['events'], queryFn: fetchEvents })
  useEffect(() => {
    const ch = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        qc.invalidateQueries({ queryKey: ['events'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return query
}
