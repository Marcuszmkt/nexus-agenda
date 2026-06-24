import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fetchAllDayEvents, type AllDayEvent } from '@/lib/all-day-events'

export function useAllDayEvents() {
  const qc = useQueryClient()
  const query = useQuery<AllDayEvent[]>({
    queryKey: ['all_day_events'],
    queryFn: fetchAllDayEvents,
  })
  useEffect(() => {
    const ch = supabase
      .channel('all-day-events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'all_day_events' }, () => {
        qc.invalidateQueries({ queryKey: ['all_day_events'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return query
}
