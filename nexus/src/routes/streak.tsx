import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Settings,
  Check,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useHabits } from '@/hooks/use-habits'
import { useHabitLogs } from '@/hooks/use-habit-logs'
import { useHabitLogsRange } from '@/hooks/use-habit-logs-range'
import { useNow } from '@/hooks/use-now'
import {
  createHabit,
  updateHabit,
  deleteHabit,
  toggleHabitLog,
  HABIT_ICONS,
  WEEKDAY_SHORT_LABELS,
  type Habit,
  type HabitLog,
} from '@/lib/habits'
import { formatTz, toTz, ymd } from '@/lib/tz'

export const Route = createFileRoute('/streak')({
  component: StreakPage,
})

const EMERALD = '#10B981'
const EMERALD_LIGHT = '#34D399'
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const WEEKDAY_MON_FIRST = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid rgba(16,185,129,0.2)',
  boxShadow: '0 8px 24px -12px rgba(16,185,129,0.25)',
}

type ChartRangeMode = 'this-week' | 'last-week' | 'this-month' | 'this-year' | 'custom'

/* ---- helpers ---- */

function groupLogsByDate(logs: HabitLog[]): Map<string, HabitLog[]> {
  const map = new Map<string, HabitLog[]>()
  for (const log of logs) {
    if (!map.has(log.log_date)) map.set(log.log_date, [])
    map.get(log.log_date)!.push(log)
  }
  return map
}

function isHabitScheduledOn(habit: Habit, date: Date): boolean {
  if (habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(date.getDay())
}

function scheduleLabel(habit: Habit): string {
  if (habit.days_of_week.length === 0 || habit.days_of_week.length === 7) return 'Todos os dias'
  return habit.days_of_week.map((d) => WEEKDAY_SHORT_LABELS[d]).join(', ')
}

function mondayOfWeek(date: Date): Date {
  const dow = date.getDay() === 0 ? 7 : date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (dow - 1))
}

/* ---- streak / month / success-rate calculations ---- */

function computeCurrentStreak(
  logsByDate: Map<string, HabitLog[]>,
  today: Date,
  monthStart: Date,
  workoutHabitIds: Set<string>,
): number {
  let streak = 0
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor >= monthStart) {
    const dayLogs = logsByDate.get(ymd(cursor)) ?? []
    const hasWorkout = dayLogs.some((l) => l.completed && workoutHabitIds.has(l.habit_id))
    if (!hasWorkout) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function computeBestStreak(
  logsByDate: Map<string, HabitLog[]>,
  monthStart: Date,
  today: Date,
  workoutHabitIds: Set<string>,
): number {
  let best = 0
  let current = 0
  const cursor = new Date(monthStart)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor <= end) {
    const dayLogs = logsByDate.get(ymd(cursor)) ?? []
    const hasWorkout = dayLogs.some((l) => l.completed && workoutHabitIds.has(l.habit_id))
    if (hasWorkout) {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return best
}

function countBusinessDaysInMonth(year: number, month0: number): number {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month0, d).getDay()
    if (dow >= 1 && dow <= 5) count++
  }
  return count
}

function computeMonthStats(
  logsByDate: Map<string, HabitLog[]>,
  monthStart: Date,
  today: Date,
  workoutHabitIds: Set<string>,
): { doneDays: number; totalBusinessDays: number } {
  const totalBusinessDays = countBusinessDaysInMonth(monthStart.getFullYear(), monthStart.getMonth())
  let doneDays = 0
  const cursor = new Date(monthStart)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow >= 1 && dow <= 5) {
      const dayLogs = logsByDate.get(ymd(cursor)) ?? []
      if (dayLogs.some((l) => l.completed && workoutHabitIds.has(l.habit_id))) doneDays++
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return { doneDays, totalBusinessDays }
}

function computeSuccessRate(
  habits: Habit[],
  logsByDate: Map<string, HabitLog[]>,
  monthStart: Date,
  today: Date,
): number {
  let scheduled = 0
  let completed = 0
  const cursor = new Date(monthStart)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor <= end) {
    const dayLogs = logsByDate.get(ymd(cursor)) ?? []
    for (const h of habits) {
      if (isHabitScheduledOn(h, cursor)) {
        scheduled++
        if (dayLogs.some((l) => l.habit_id === h.id && l.completed)) completed++
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100)
}

/* ---- frequency chart bucketing ---- */

type ChartBucket = { label: string; start: Date; end: Date }

function monthWeekBuckets(year: number, month0: number): ChartBucket[] {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const buckets: ChartBucket[] = []
  let weekStart = mondayOfWeek(first)
  let idx = 1
  while (weekStart <= last) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    buckets.push({
      label: `Sem ${idx}`,
      start: weekStart < first ? first : weekStart,
      end: weekEnd > last ? last : weekEnd,
    })
    idx++
    weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
  }
  return buckets
}

function customBuckets(from: Date, to: Date): ChartBucket[] {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1

  if (days <= 14) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(from)
      d.setDate(from.getDate() + i)
      return { label: formatTz(d, 'd/MM'), start: d, end: d }
    })
  }

  if (days <= 120) {
    const buckets: ChartBucket[] = []
    let weekStart = new Date(from)
    let idx = 1
    while (weekStart <= to) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      buckets.push({ label: `Sem ${idx}`, start: weekStart, end: weekEnd > to ? to : weekEnd })
      idx++
      weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
    }
    return buckets
  }

  const buckets: ChartBucket[] = []
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  while (cursor <= to) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    buckets.push({
      label: `${MONTH_LABELS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
      start: cursor < from ? from : cursor,
      end: monthEnd > to ? to : monthEnd,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return buckets
}

function buildChartBuckets(mode: ChartRangeMode, fromStr: string, toStr: string): ChartBucket[] {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)

  if (mode === 'this-week' || mode === 'last-week') {
    return WEEKDAY_MON_FIRST.map((label, i) => {
      const d = new Date(from)
      d.setDate(from.getDate() + i)
      return { label, start: d, end: d }
    })
  }
  if (mode === 'this-year') {
    return MONTH_LABELS.map((label, i) => ({
      label,
      start: new Date(from.getFullYear(), i, 1),
      end: new Date(from.getFullYear(), i + 1, 0),
    }))
  }
  if (mode === 'this-month') {
    return monthWeekBuckets(from.getFullYear(), from.getMonth())
  }
  return customBuckets(from, to)
}

function computeBucketedFrequency(
  habits: Habit[],
  logsByDate: Map<string, HabitLog[]>,
  buckets: ChartBucket[],
  today: Date,
): { label: string; pct: number }[] {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return buckets.map(({ label, start, end }) => {
    const rangeEnd = end > todayMidnight ? todayMidnight : end
    if (start > rangeEnd) return { label, pct: 0 }
    let scheduled = 0
    let completed = 0
    const cursor = new Date(start)
    while (cursor <= rangeEnd) {
      const dayLogs = logsByDate.get(ymd(cursor)) ?? []
      for (const h of habits) {
        if (isHabitScheduledOn(h, cursor)) {
          scheduled++
          if (dayLogs.some((l) => l.habit_id === h.id && l.completed)) completed++
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return { label, pct: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100) }
  })
}

/* ---- mini calendar dot status ---- */

type DotStatus = 'full' | 'partial' | 'red' | 'future' | 'none'

function dayStatus(date: Date, habits: Habit[], logsByDate: Map<string, HabitLog[]>, todayStr: string): DotStatus {
  const dateStr = ymd(date)
  const scheduled = habits.filter((h) => isHabitScheduledOn(h, date))
  if (dateStr > todayStr) return 'future'
  if (scheduled.length === 0) return 'none'
  const dayLogs = logsByDate.get(dateStr) ?? []
  const completedCount = scheduled.filter((h) => dayLogs.some((l) => l.habit_id === h.id && l.completed)).length
  if (completedCount === 0) return 'red'
  if (completedCount === scheduled.length) return 'full'
  return 'partial'
}

function dotClasses(status: DotStatus): string {
  switch (status) {
    case 'full':
      return 'bg-[#10B981] text-black'
    case 'partial':
      return 'border-2 border-[#10B981] text-[#34D399] bg-transparent'
    case 'red':
      return 'bg-[#EF4444]/80 text-white'
    case 'future':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted/40 text-muted-foreground'
  }
}

/* ---- page ---- */

function StreakPage() {
  const rawNow = useNow(60_000)
  const now = toTz(rawNow)
  const todayStr = ymd(now)
  const hour = now.getHours()
  const greeting = hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'

  const { data: habits = [] } = useHabits()
  const workoutHabitIds = useMemo(
    () => new Set(habits.filter((h) => h.category === 'workout').map((h) => h.id)),
    [habits],
  )
  const chartHabits = useMemo(() => habits.filter((h) => h.category !== 'general'), [habits])

  const { data: statsLogs = [] } = useHabitLogs(now.getFullYear(), now.getMonth() + 1)
  const statsLogsByDate = useMemo(() => groupLogsByDate(statsLogs), [statsLogs])
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])

  const currentStreak = useMemo(
    () => computeCurrentStreak(statsLogsByDate, now, monthStart, workoutHabitIds),
    [statsLogsByDate, now, monthStart, workoutHabitIds],
  )
  const bestStreak = useMemo(
    () => computeBestStreak(statsLogsByDate, monthStart, now, workoutHabitIds),
    [statsLogsByDate, monthStart, now, workoutHabitIds],
  )
  const { doneDays, totalBusinessDays } = useMemo(
    () => computeMonthStats(statsLogsByDate, monthStart, now, workoutHabitIds),
    [statsLogsByDate, monthStart, now, workoutHabitIds],
  )
  const monthPct = totalBusinessDays === 0 ? 0 : Math.round((doneDays / totalBusinessDays) * 100)
  const successRate = useMemo(
    () => computeSuccessRate(habits, statsLogsByDate, monthStart, now),
    [habits, statsLogsByDate, monthStart, now],
  )

  const todayHabits = useMemo(() => habits.filter((h) => isHabitScheduledOn(h, now)), [habits, now])
  const todayLogs = statsLogsByDate.get(todayStr) ?? []

  const [manageOpen, setManageOpen] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const { data: calendarLogs = [] } = useHabitLogs(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1)
  const calendarLogsByDate = useMemo(() => groupLogsByDate(calendarLogs), [calendarLogs])
  const [selectedDay, setSelectedDay] = useState(todayStr)

  const [chartRange, setChartRange] = useState<ChartRangeMode>('this-month')
  const [customFrom, setCustomFrom] = useState(() => ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [customTo, setCustomTo] = useState(todayStr)

  const { chartFrom, chartTo } = useMemo(() => {
    if (chartRange === 'this-week') {
      const start = mondayOfWeek(now)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { chartFrom: ymd(start), chartTo: ymd(end) }
    }
    if (chartRange === 'last-week') {
      const start = mondayOfWeek(now)
      start.setDate(start.getDate() - 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { chartFrom: ymd(start), chartTo: ymd(end) }
    }
    if (chartRange === 'this-year') {
      return { chartFrom: `${now.getFullYear()}-01-01`, chartTo: `${now.getFullYear()}-12-31` }
    }
    if (chartRange === 'custom') {
      return customFrom <= customTo
        ? { chartFrom: customFrom, chartTo: customTo }
        : { chartFrom: customTo, chartTo: customFrom }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { chartFrom: ymd(start), chartTo: ymd(end) }
  }, [chartRange, now, customFrom, customTo])

  const { data: chartLogs = [] } = useHabitLogsRange(chartFrom, chartTo)
  const chartLogsByDate = useMemo(() => groupLogsByDate(chartLogs), [chartLogs])

  const weeklyFrequency = useMemo(() => {
    const buckets = buildChartBuckets(chartRange, chartFrom, chartTo)
    return computeBucketedFrequency(chartHabits, chartLogsByDate, buckets, now)
  }, [chartRange, chartFrom, chartTo, chartHabits, chartLogsByDate, now])

  async function handleToggleHabit(habitId: string, completed: boolean) {
    try {
      await toggleHabitLog(habitId, todayStr, completed)
    } catch {
      toast.error('Erro ao atualizar hábito')
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--color-background)' }}>
        <div className="w-full px-6 sm:px-8 py-6 sm:py-10 flex flex-col gap-6 text-foreground">
          <section>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{greeting} 💪</h2>
            <p className="mt-2 text-sm text-muted-foreground first-letter:uppercase">
              {formatTz(now, "EEEE, d 'de' MMMM 'de' yyyy")}
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl p-5 bg-card" style={CARD_STYLE}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-lg">🔥</span> Sequência atual
                  </div>
                  <div className="mt-2 text-4xl font-bold" style={{ color: EMERALD_LIGHT }}>
                    {currentStreak}
                    <span className="ml-1 text-base font-medium text-muted-foreground">dias</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Melhor sequência: {bestStreak} dias</div>
                </div>

                <div className="rounded-2xl p-5 bg-card" style={CARD_STYLE}>
                  <div className="text-sm text-muted-foreground">Este mês</div>
                  <div className="mt-2 text-4xl font-bold" style={{ color: EMERALD_LIGHT }}>
                    {doneDays}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/{totalBusinessDays} dias</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${monthPct}%`, background: `linear-gradient(90deg, ${EMERALD}, ${EMERALD_LIGHT})` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{monthPct}% da meta mensal</div>
                </div>

                <div className="rounded-2xl p-5 flex flex-col items-center bg-card" style={CARD_STYLE}>
                  <div className="self-start text-sm text-muted-foreground">Taxa de sucesso</div>
                  <SuccessRateRing pct={successRate} />
                  <div className="mt-1 text-xs text-center text-muted-foreground">
                    {successRate >= 70 ? 'Ótimo trabalho!' : successRate >= 40 ? 'Continue assim!' : 'Vamos melhorar!'}
                  </div>
                </div>
              </div>

              <section className="rounded-2xl p-6 bg-card" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold">Frequência de hábitos</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {chartRange === 'custom' && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="h-8 w-[142px] text-xs"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="h-8 w-[142px] text-xs"
                        />
                      </div>
                    )}
                    <div className="relative inline-flex items-center">
                      <select
                        value={chartRange}
                        onChange={(e) => setChartRange(e.target.value as ChartRangeMode)}
                        className="appearance-none inline-flex items-center gap-1 text-xs rounded-lg pl-2.5 pr-7 py-1.5 bg-muted/50 hover:bg-muted text-muted-foreground transition-colors cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="this-week">Esta semana</option>
                        <option value="last-week">Semana passada</option>
                        <option value="this-month">Este mês</option>
                        <option value="this-year">Este ano</option>
                        <option value="custom">Personalizado</option>
                      </select>
                      <ChevronDown className="size-3.5 pointer-events-none absolute right-2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="h-[320px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyFrequency} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="streakAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={EMERALD} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-muted-foreground)"
                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="var(--color-muted-foreground)"
                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                        width={40}
                      />
                      <Tooltip content={<StreakChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="pct"
                        stroke={EMERALD}
                        strokeWidth={2}
                        fill="url(#streakAreaFill)"
                        dot={{ r: 4, stroke: EMERALD, strokeWidth: 2, fill: 'var(--color-card)' }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl p-6 bg-card" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Hábitos de hoje</h3>
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-foreground"
                    style={{ color: EMERALD_LIGHT }}
                  >
                    <Settings className="size-3.5" /> Gerenciar hábitos
                  </button>
                </div>
                {todayHabits.length === 0 ? (
                  <p className="text-sm text-center py-6 text-muted-foreground">
                    Nenhum hábito para hoje. Cadastre um em "Gerenciar hábitos".
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {todayHabits.map((h) => {
                      const completed = todayLogs.some((l) => l.habit_id === h.id && l.completed)
                      return <HabitRow key={h.id} habit={h} completed={completed} onToggle={(v) => handleToggleHabit(h.id, v)} />
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6">
              <section className="rounded-2xl p-6 bg-card" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalendarCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                    className="size-7 inline-flex items-center justify-center rounded hover:bg-accent"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="font-medium first-letter:uppercase">{formatTz(calendarCursor, "MMMM 'de' yyyy")}</div>
                  <button
                    type="button"
                    onClick={() => setCalendarCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                    className="size-7 inline-flex items-center justify-center rounded hover:bg-accent"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-[10px] mb-1 text-muted-foreground">
                  {WEEKDAY_SHORT_LABELS.map((c, i) => (
                    <div key={i} className="text-center">{c[0]}</div>
                  ))}
                </div>
                <HabitDotsGrid
                  cursor={calendarCursor}
                  habits={habits}
                  logsByDate={calendarLogsByDate}
                  todayStr={todayStr}
                  selectedDay={selectedDay}
                  onSelect={setSelectedDay}
                />
              </section>

              <DayDetails date={selectedDay} habits={habits} logsByDate={calendarLogsByDate} />
            </div>
          </div>
        </div>
      </div>

      <ManageHabitsModal open={manageOpen} onClose={() => setManageOpen(false)} habits={habits} />
    </AppShell>
  )
}

/* ---- weekly chart tooltip ---- */

function StreakChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg bg-card" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{payload[0].value}% concluído</div>
    </div>
  )
}

/* ---- success rate ring ---- */

function SuccessRateRing({ pct }: { pct: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference
  return (
    <div className="relative my-2" style={{ width: 96, height: 96 }}>
      <svg width={96} height={96} viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={EMERALD}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">{pct}%</div>
    </div>
  )
}

/* ---- habit row (hábitos de hoje) ---- */

function HabitRow({
  habit,
  completed,
  onToggle,
}: {
  habit: Habit
  completed: boolean
  onToggle: (completed: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`rounded-xl transition-colors ${completed ? 'bg-emerald-500/10' : 'bg-muted/40'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-xl shrink-0">{habit.icon}</span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium truncate ${completed ? '' : 'text-foreground'}`}
            style={completed ? { color: EMERALD_LIGHT } : undefined}
          >
            {habit.title}
          </div>
          <div className="text-xs truncate text-muted-foreground">
            {scheduleLabel(habit)}
            {habit.scheduled_time ? ` · ${habit.scheduled_time.slice(0, 5)}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          aria-label="Concluir hábito"
          className="size-6 rounded-md border-2 inline-flex items-center justify-center shrink-0 transition-colors"
          style={{ background: completed ? EMERALD : 'transparent', borderColor: completed ? EMERALD : 'var(--color-border)' }}
        >
          {completed && <Check className="size-4 text-black" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={open ? 'Recolher' : 'Expandir'}
        >
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-11 text-xs text-muted-foreground">
          Dias: {scheduleLabel(habit)}
          {habit.scheduled_time ? ` · Horário: ${habit.scheduled_time.slice(0, 5)}` : ' · Sem horário definido'}
        </div>
      )}
    </li>
  )
}

/* ---- mini calendar dots grid ---- */

function HabitDotsGrid({
  cursor,
  habits,
  logsByDate,
  todayStr,
  selectedDay,
  onSelect,
}: {
  cursor: Date
  habits: Habit[]
  logsByDate: Map<string, HabitLog[]>
  todayStr: string
  selectedDay: string
  onSelect: (date: string) => void
}) {
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((day, i) => {
        if (day === null) return <div key={`empty-${i}`} />
        const date = new Date(cursor.getFullYear(), cursor.getMonth(), day)
        const dateStr = ymd(date)
        const status = dayStatus(date, habits, logsByDate, todayStr)
        const isToday = dateStr === todayStr
        const isSelected = dateStr === selectedDay
        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelect(dateStr)}
            className={`size-8 rounded-full inline-flex items-center justify-center text-[11px] font-medium transition-colors ${dotClasses(status)} ${
              isSelected ? 'outline outline-2 outline-foreground/50 outline-offset-1' : ''
            }`}
            style={isToday ? { boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${EMERALD_LIGHT}` } : undefined}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

/* ---- day details ---- */

function DayDetails({
  date,
  habits,
  logsByDate,
}: {
  date: string
  habits: Habit[]
  logsByDate: Map<string, HabitLog[]>
}) {
  const [y, m, d] = date.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const scheduled = habits.filter((h) => isHabitScheduledOn(h, dateObj))
  const dayLogs = logsByDate.get(date) ?? []
  const done = scheduled.filter((h) => dayLogs.some((l) => l.habit_id === h.id && l.completed))
  const notDone = scheduled.filter((h) => !dayLogs.some((l) => l.habit_id === h.id && l.completed))

  return (
    <section className="rounded-2xl p-6 bg-card" style={CARD_STYLE}>
      <h3 className="text-lg font-semibold">Detalhes do dia</h3>
      <p className="mt-1 mb-4 text-sm text-muted-foreground first-letter:uppercase">
        {formatTz(dateObj, "EEEE, d 'de' MMMM 'de' yyyy")}
      </p>

      {scheduled.length === 0 ? (
        <p className="text-sm text-center py-4 text-muted-foreground">Nenhum registro para este dia.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {done.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2" style={{ color: EMERALD_LIGHT }}>Concluídos ({done.length})</div>
              <ul className="flex flex-col gap-1.5">
                {done.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    <span>✅</span>
                    <span>{h.icon} {h.title}</span>
                    {h.scheduled_time && <span className="text-xs text-muted-foreground">· {h.scheduled_time.slice(0, 5)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notDone.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">Não concluídos ({notDone.length})</div>
              <ul className="flex flex-col gap-1.5">
                {notDone.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm text-foreground/70">
                    <span>❌</span>
                    <span>{h.icon} {h.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 pt-4 border-t border-border text-xs italic text-center text-muted-foreground">
        "Consistência é o que transforma dias comuns em resultados extraordinários."
      </p>
    </section>
  )
}

/* ---- manage habits modal ---- */

function ManageHabitsModal({
  open,
  onClose,
  habits,
}: {
  open: boolean
  onClose: () => void
  habits: Habit[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(HABIT_ICONS[0])
  const [days, setDays] = useState<number[]>([])
  const [hasTime, setHasTime] = useState(false)
  const [time, setTime] = useState('09:00')
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setEditingId(null)
    setName('')
    setIcon(HABIT_ICONS[0])
    setDays([])
    setHasTime(false)
    setTime('09:00')
  }

  function startEdit(h: Habit) {
    setEditingId(h.id)
    setName(h.title)
    setIcon(h.icon)
    setDays(h.days_of_week)
    setHasTime(!!h.scheduled_time)
    setTime(h.scheduled_time ? h.scheduled_time.slice(0, 5) : '09:00')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Dê um nome ao hábito'); return }
    if (days.length === 0) { toast.error('Selecione ao menos um dia'); return }
    setSaving(true)
    try {
      const input = {
        title: name.trim(),
        icon,
        days_of_week: days,
        scheduled_time: hasTime ? `${time}:00` : null,
      }
      if (editingId) {
        await updateHabit(editingId, input)
        toast.success('Hábito atualizado')
      } else {
        await createHabit(input)
        toast.success('Hábito criado')
      }
      resetForm()
    } catch {
      toast.error('Erro ao salvar hábito')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHabit(id)
      if (editingId === id) resetForm()
      toast.success('Hábito removido')
    } catch {
      toast.error('Erro ao remover hábito')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
        <DialogHeader>
          <DialogTitle>Gerenciar hábitos</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Beber água"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className="size-9 rounded-lg text-lg inline-flex items-center justify-center border transition-colors"
                  style={{
                    borderColor: icon === ic ? EMERALD : 'var(--color-border)',
                    background: icon === ic ? 'rgba(16,185,129,0.15)' : 'transparent',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Dias da semana</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT_LABELS.map((label, idx) => {
                const active = days.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))}
                    className="size-9 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: active ? EMERALD : 'var(--color-muted)',
                      color: active ? '#000' : 'var(--color-muted-foreground)',
                    }}
                  >
                    {label[0]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={hasTime} onCheckedChange={setHasTime} />
            <Label className="cursor-pointer text-muted-foreground">Horário opcional</Label>
            {hasTime && (
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-32"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
            <Button type="submit" disabled={saving} style={{ background: EMERALD, color: '#000' }} className="hover:opacity-90">
              {editingId ? 'Salvar alterações' : 'Adicionar hábito'}
            </Button>
          </div>
        </form>

        <div className="border-t border-border pt-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
          {habits.length === 0 ? (
            <p className="text-sm text-center py-2 text-muted-foreground">Nenhum hábito cadastrado ainda.</p>
          ) : (
            habits.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-lg">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{h.title}</div>
                  <div className="text-xs truncate text-muted-foreground">
                    {scheduleLabel(h)}
                    {h.scheduled_time ? ` · ${h.scheduled_time.slice(0, 5)}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => startEdit(h)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                  <Pencil className="size-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(h.id)} className="text-muted-foreground hover:text-red-500 transition-colors" aria-label="Excluir">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
