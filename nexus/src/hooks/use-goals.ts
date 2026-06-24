import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fetchGoals, type Goal } from '@/lib/goals'

export function useGoals(year = 2026) {
  const qc = useQueryClient()
  const query = useQuery<Goal[]>({
    queryKey: ['goals', year],
    queryFn: () => fetchGoals(year),
  })
  useEffect(() => {
    const ch = supabase
      .channel('goals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
        qc.invalidateQueries({ queryKey: ['goals'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return query
}
