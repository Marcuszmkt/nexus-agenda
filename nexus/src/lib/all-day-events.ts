import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'

export type AllDayEventPriority = 'important' | 'common'

export type AllDayEvent = {
  id: string
  title: string
  event_date: string
  color: string
  priority: AllDayEventPriority
  created_at: string
}

export async function fetchAllDayEvents(): Promise<AllDayEvent[]> {
  const { data, error } = await supabase
    .from('all_day_events')
    .select('*')
    .order('event_date', { ascending: true })
  if (error) throw error
  return (data as AllDayEvent[]).map((e) => ({
    ...e,
    priority: (e.priority as AllDayEventPriority) ?? 'common',
  }))
}

export async function createAllDayEvent(input: {
  title: string
  event_date: string
  color?: string
  priority?: AllDayEventPriority
}): Promise<void> {
  const { error } = await supabase.from('all_day_events').insert({
    title: input.title,
    event_date: input.event_date,
    color: input.color ?? '#6B7280',
    priority: input.priority ?? 'common',
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['all_day_events'] })
}

export async function updateAllDayEvent(
  id: string,
  input: { title: string; event_date: string; color: string; priority?: AllDayEventPriority },
): Promise<void> {
  const { error } = await supabase
    .from('all_day_events')
    .update({
      title: input.title,
      event_date: input.event_date,
      color: input.color,
      priority: input.priority ?? 'common',
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['all_day_events'] })
}

export async function deleteAllDayEvent(id: string): Promise<void> {
  const { error } = await supabase.from('all_day_events').delete().eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['all_day_events'] })
}
