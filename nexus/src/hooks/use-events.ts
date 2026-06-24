import { useQuery } from '@tanstack/react-query'
import { fetchEvents, type CalendarEvent } from '@/lib/events'

export function useEvents() {
  return useQuery<CalendarEvent[]>({ queryKey: ['events'], queryFn: fetchEvents })
}
