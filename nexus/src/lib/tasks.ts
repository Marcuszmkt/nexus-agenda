import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'
import { ymd, addDays } from '@/lib/tz'

export type TaskPriority = 'important' | 'common'

export type Task = {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  completed: boolean
  priority: TaskPriority
  created_at: string
  missed: boolean
  missed_at: string | null
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: true })
  if (error) throw error
  return (data as Task[]).map((t) => ({
    ...t,
    priority: (t.priority as TaskPriority) ?? 'common',
    missed: (t.missed as boolean) ?? false,
    missed_at: (t.missed_at as string | null) ?? null,
  }))
}

export async function createTask(input: {
  title: string
  scheduled_date: string
  scheduled_time: string | null
  priority?: TaskPriority
}): Promise<void> {
  const { error } = await supabase.from('tasks').insert({
    title: input.title,
    scheduled_date: input.scheduled_date,
    scheduled_time: input.scheduled_time ?? null,
    priority: input.priority ?? 'common',
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function createRecurringTasks(input: {
  title: string
  startDate: string
  endDate: string
  scheduled_time: string | null
  priority: TaskPriority
  frequency: 'daily' | 'weekly' | 'monthly'
  weekDays?: number[]
}): Promise<void> {
  const dates = generateDates(input.startDate, input.endDate, input.frequency, input.weekDays)
  if (dates.length === 0) return
  const rows = dates.map((d) => ({
    title: input.title,
    scheduled_date: d,
    scheduled_time: input.scheduled_time,
    priority: input.priority,
  }))
  const { error } = await supabase.from('tasks').insert(rows)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function toggleTask(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({ completed }).eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function postponeTask(id: string, currentDate: string): Promise<void> {
  const [y, m, d] = currentDate.split('-').map(Number)
  const tomorrow = new Date(y, m - 1, d + 1)
  const { error } = await supabase
    .from('tasks')
    .update({ scheduled_date: ymd(tomorrow) })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function postponeAllTasks(ids: string[], currentDate: string): Promise<void> {
  const [y, m, d] = currentDate.split('-').map(Number)
  const tomorrow = ymd(new Date(y, m - 1, d + 1))
  const { error } = await supabase
    .from('tasks')
    .update({ scheduled_date: tomorrow })
    .in('id', ids)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function markMissedTasks(items: { id: string; scheduled_date: string }[]): Promise<void> {
  if (items.length === 0) return
  await Promise.all(
    items.map(({ id, scheduled_date }) =>
      supabase.from('tasks').update({ missed: true, missed_at: scheduled_date }).eq('id', id),
    ),
  )
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

export async function retryMissedTask(task: Task, scheduledDate: string): Promise<void> {
  const { error } = await supabase.from('tasks').insert({
    title: task.title,
    scheduled_date: scheduledDate,
    scheduled_time: task.scheduled_time,
    priority: task.priority,
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
}

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
    const dateStr = ymd(current)
    if (frequency === 'daily') {
      results.push(dateStr)
      current = addDays(current, 1)
    } else if (frequency === 'weekly') {
      const days = weekDays && weekDays.length > 0 ? weekDays : [current.getDay()]
      if (days.includes(current.getDay())) {
        results.push(dateStr)
      }
      current = addDays(current, 1)
    } else {
      results.push(dateStr)
      current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate())
    }
  }
  return results
}
