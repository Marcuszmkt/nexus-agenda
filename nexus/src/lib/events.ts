import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'
import { ymd, addDays, combineZonedDayAndTime, toTz } from '@/lib/tz'

export type EventPriority = 'important' | 'common'

export type EventRow = {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  color: string
  priority: EventPriority
  completed: boolean
  created_at: string
  updated_at: string
}

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  start: Date
  end: Date
  color: string
  priority: EventPriority
  completed: boolean
}

function fromRow(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start: new Date(row.start_at),
    end: new Date(row.end_at),
    color: row.color,
    priority: (row.priority as EventPriority) ?? 'common',
    completed: (row.completed as boolean) ?? false,
  }
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_at', { ascending: true })
  if (error) throw error
  return (data as EventRow[]).map(fromRow)
}

export async function createEvent(input: {
  title: string
  description?: string | null
  start: Date
  end: Date
  color: string
  priority?: EventPriority
}): Promise<void> {
  const { error } = await supabase.from('events').insert({
    title: input.title,
    description: input.description ?? null,
    start_at: input.start.toISOString(),
    end_at: input.end.toISOString(),
    color: input.color,
    priority: input.priority ?? 'common',
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function createRecurringEvents(input: {
  title: string
  description: string | null
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  color: string
  priority: EventPriority
  frequency: 'daily' | 'weekly' | 'monthly'
  weekDays?: number[]
}): Promise<void> {
  const dates = generateDates(input.startDate, input.endDate, input.frequency, input.weekDays)
  if (dates.length === 0) return
  const rows = dates.map((d) => {
    const [y, m, day] = d.split('-').map(Number)
    const zonedDay = toTz(new Date(Date.UTC(y, m - 1, day, 12)))
    const start = combineZonedDayAndTime(zonedDay, input.startTime)
    const end = combineZonedDayAndTime(zonedDay, input.endTime)
    return {
      title: input.title,
      description: input.description,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      color: input.color,
      priority: input.priority,
    }
  })
  const { error } = await supabase.from('events').insert(rows)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function updateEvent(
  id: string,
  input: {
    title: string
    description?: string | null
    start: Date
    end: Date
    color: string
    priority?: EventPriority
  },
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      title: input.title,
      description: input.description ?? null,
      start_at: input.start.toISOString(),
      end_at: input.end.toISOString(),
      color: input.color,
      priority: input.priority ?? 'common',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function postponeEvent(id: string, start: Date, end: Date): Promise<void> {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const { error } = await supabase
    .from('events')
    .update({
      start_at: new Date(start.getTime() + MS_PER_DAY).toISOString(),
      end_at: new Date(end.getTime() + MS_PER_DAY).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function postponeAllEvents(
  items: { id: string; start: Date; end: Date }[],
): Promise<void> {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  await Promise.all(
    items.map(({ id, start, end }) =>
      supabase.from('events').update({
        start_at: new Date(start.getTime() + MS_PER_DAY).toISOString(),
        end_at: new Date(end.getTime() + MS_PER_DAY).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    ),
  )
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export async function toggleEvent(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from('events').update({ completed }).eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['events'] })
}

export const EVENT_COLORS = ['#7C3AED', '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#FF7043']

function generateDates(
  startDate: string,
  endDate: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  weekDays?: number[],
): string[] {
  const results: string[] = []
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  let current = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const MAX = 365

  while (current <= end && results.length < MAX) {
    if (frequency === 'daily') {
      results.push(ymd(current))
      current = addDays(current, 1)
    } else if (frequency === 'weekly') {
      const days = weekDays && weekDays.length > 0 ? weekDays : [current.getDay()]
      if (days.includes(current.getDay())) results.push(ymd(current))
      current = addDays(current, 1)
    } else {
      results.push(ymd(current))
      const lastDayOfNext = new Date(current.getFullYear(), current.getMonth() + 2, 0).getDate()
      current = new Date(current.getFullYear(), current.getMonth() + 1, Math.min(sd, lastDayOfNext))
    }
  }
  return results
}
