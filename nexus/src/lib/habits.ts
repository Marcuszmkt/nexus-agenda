import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'

export type Habit = {
  id: string
  title: string
  icon: string
  days_of_week: number[]
  scheduled_time: string | null
  created_at: string
}

export type HabitLog = {
  id: string
  habit_id: string
  log_date: string
  completed: boolean
  created_at: string
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Habit[]).map((h) => ({ ...h, days_of_week: h.days_of_week ?? [] }))
}

export async function createHabit(input: {
  title: string
  icon: string
  days_of_week: number[]
  scheduled_time?: string | null
}): Promise<void> {
  const { error } = await supabase.from('habits').insert({
    title: input.title,
    icon: input.icon,
    days_of_week: input.days_of_week,
    scheduled_time: input.scheduled_time ?? null,
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['habits'] })
}

export async function updateHabit(
  id: string,
  input: {
    title: string
    icon: string
    days_of_week: number[]
    scheduled_time?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({
      title: input.title,
      icon: input.icon,
      days_of_week: input.days_of_week,
      scheduled_time: input.scheduled_time ?? null,
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['habits'] })
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['habits'] })
  queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
}

export async function fetchHabitLogs(month: number, year: number): Promise<HabitLog[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .gte('log_date', from)
    .lte('log_date', to)
  if (error) throw error
  return data as HabitLog[]
}

export async function toggleHabitLog(habitId: string, date: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, log_date: date, completed },
      { onConflict: 'habit_id,log_date' },
    )
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
}

export const HABIT_ICONS = ['🏋️', '🥗', '💧', '😴', '📚', '🏃', '🧘', '💊']

export const WEEKDAY_SHORT_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
