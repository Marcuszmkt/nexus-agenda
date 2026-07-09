-- The `habits` / `habit_logs` tables already exist in this project (title, icon, days_of_week,
-- order_index, created_at / id, habit_id, log_date, completed, note, created_at — with a unique
-- constraint on habit_logs(habit_id, log_date) already in place, so upserts already work).
--
-- The only thing missing for the Streak page's home-spotlight integration is an optional
-- time-of-day column on habits. Run this once in the Supabase SQL editor.

alter table public.habits add column if not exists scheduled_time time;

-- Required for the realtime subscriptions used by useHabits/useHabitLogs.
-- Safe to re-run: ignores the error if the table is already published.
do $$ begin
  alter publication supabase_realtime add table public.habits;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.habit_logs;
exception when duplicate_object then null;
end $$;
