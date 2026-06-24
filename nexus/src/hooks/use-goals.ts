import { useQuery } from '@tanstack/react-query'
import { fetchGoals, type Goal } from '@/lib/goals'

export function useGoals(year = 2026) {
  return useQuery<Goal[]>({
    queryKey: ['goals', year],
    queryFn: () => fetchGoals(year),
  })
}
