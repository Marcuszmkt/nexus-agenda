import { supabase } from '@/integrations/supabase/client'
import { queryClient } from '@/lib/query-client'

export type GoalType = 'unique' | 'quantity'

export type Goal = {
  id: string
  title: string
  completed: boolean
  completed_at: string | null
  year: number
  type: GoalType
  current_value: number
  target_value: number
  unit: string | null
  created_at: string
}

export async function fetchGoals(year = 2026): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('year', year)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Goal[]
}

export async function createGoal(input: {
  title: string
  year?: number
  type: GoalType
  target_value?: number
  unit?: string | null
}): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    title: input.title,
    year: input.year ?? 2026,
    type: input.type,
    target_value: input.type === 'unique' ? 1 : (input.target_value ?? 1),
    current_value: 0,
    unit: input.type === 'unique' ? null : (input.unit ?? null),
    completed: false,
    completed_at: null,
  })
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['goals'] })
}

export async function updateGoal(
  id: string,
  input: {
    title: string
    type: GoalType
    target_value: number
    unit: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({
      title: input.title,
      type: input.type,
      target_value: input.target_value,
      unit: input.unit,
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['goals'] })
}

export async function toggleGoal(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({
      completed,
      current_value: completed ? 1 : 0,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['goals'] })
}

export async function setGoalProgress(
  id: string,
  current_value: number,
  target_value: number,
): Promise<void> {
  const clamped = Math.max(0, current_value)
  const completed = clamped >= target_value
  const { error } = await supabase
    .from('goals')
    .update({
      current_value: clamped,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['goals'] })
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['goals'] })
}

export function goalProgressPct(g: Goal): number {
  if (g.type === 'unique') return g.completed ? 100 : 0
  if (!g.target_value) return 0
  return Math.min(100, Math.round((g.current_value / g.target_value) * 100))
}
