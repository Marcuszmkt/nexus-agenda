import { useQuery } from '@tanstack/react-query'
import { fetchAllDayEvents, type AllDayEvent } from '@/lib/all-day-events'

export function useAllDayEvents() {
  return useQuery<AllDayEvent[]>({
    queryKey: ['all_day_events'],
    queryFn: fetchAllDayEvents,
  })
}
