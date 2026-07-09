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
const MUTED = '#9CA3AF'

const CARD_STYLE: React.CSSProperties = {
  background: '#111A11',
  border: '1px solid rgba(16,185,129,0.2)',
  boxShadow: '0 8px 24px -12px rgba(16,185,129,0.25)',
}

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

function computeCurrentStreak(logsByDate: Map<string, HabitLog[]>, today: Date, monthStart: Date): number {
  let streak = 0
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor >= monthStart) {
    const dayLogs = logsByDate.get(ymd(cursor)) ?? []
    if (!dayLogs.some((l) => l.completed)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function computeBestStreak(logsByDate: Map<string, HabitLog[]>, monthStart: Date, today: Date): number {
  let best = 0
  let current = 0
  const cursor = new Date(monthStart)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor <= end) {
    const dayLogs = logsByDate.get(ymd(cursor)) ?? []
    if (dayLogs.some((l) => l.completed)) {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return best
}

function computeMonthStats(
  habits: Habit[],
  logsByDate: Map<string, HabitLog[]>,
  monthStart: Date,
  today: Date,
): { doneDays: number; scheduledDays: number } {
  let doneDays = 0
  let scheduledDays = 0
  const cursor = new Date(monthStart)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  while (cursor <= end) {
    if (habits.some((h) => isHabitScheduledOn(h, cursor))) {
      scheduledDays++
      const dayLogs = logsByDate.get(ymd(cursor)) ?? []
      if (dayLogs.some((l) => l.completed)) doneDays++
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return { doneDays, scheduledDays }
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

function computeWeeklyFrequency(
  habits: Habit[],
  logsByDate: Map<string, HabitLog[]>,
  today: Date,
  monthStart: Date,
): { label: string; pct: number }[] {
  const dow = today.getDay() === 0 ? 7 : today.getDay()
  const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dow - 1))
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return Array.from({ length: 4 }, (_, i) => {
    const weeksAgo = 3 - i
    const start = new Date(thisWeekStart)
    start.setDate(thisWeekStart.getDate() - weeksAgo * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const rangeStart = start < monthStart ? monthStart : start
    const rangeEnd = end > todayMidnight ? todayMidnight : end

    let scheduled = 0
    let completed = 0
    const cursor = new Date(rangeStart)
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
    return { label: `Sem ${i + 1}`, pct: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100) }
  })
}

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
      return 'bg-[#374151]/50 text-[#9CA3AF]'
    default:
      return 'bg-white/[0.04] text-[#6B7280]'
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
  const { data: statsLogs = [] } = useHabitLogs(now.getFullYear(), now.getMonth() + 1)
  const statsLogsByDate = useMemo(() => groupLogsByDate(statsLogs), [statsLogs])
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])

  const currentStreak = useMemo(() => computeCurrentStreak(statsLogsByDate, now, monthStart), [statsLogsByDate, now, monthStart])
  const bestStreak = useMemo(() => computeBestStreak(statsLogsByDate, monthStart, now), [statsLogsByDate, monthStart, now])
  const { doneDays, scheduledDays } = useMemo(
    () => computeMonthStats(habits, statsLogsByDate, monthStart, now),
    [habits, statsLogsByDate, monthStart, now],
  )
  const monthPct = scheduledDays === 0 ? 0 : Math.round((doneDays / scheduledDays) * 100)
  const successRate = useMemo(
    () => computeSuccessRate(habits, statsLogsByDate, monthStart, now),
    [habits, statsLogsByDate, monthStart, now],
  )
  const weeklyFrequency = useMemo(
    () => computeWeeklyFrequency(habits, statsLogsByDate, now, monthStart),
    [habits, statsLogsByDate, now, monthStart],
  )

  const todayHabits = useMemo(() => habits.filter((h) => isHabitScheduledOn(h, now)), [habits, now])
  const todayLogs = statsLogsByDate.get(todayStr) ?? []

  const [manageOpen, setManageOpen] = useState(false)
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const { data: calendarLogs = [] } = useHabitLogs(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1)
  const calendarLogsByDate = useMemo(() => groupLogsByDate(calendarLogs), [calendarLogs])
  const [selectedDay, setSelectedDay] = useState(todayStr)

  async function handleToggleHabit(habitId: string, completed: boolean) {
    try {
      await toggleHabitLog(habitId, todayStr, completed)
    } catch {
      toast.error('Erro ao atualizar hábito')
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: '#0A0F0A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 text-white">
          <section>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{greeting} 💪</h2>
            <p className="mt-2 text-sm first-letter:uppercase" style={{ color: MUTED }}>
              {formatTz(now, "EEEE, d 'de' MMMM 'de' yyyy")}
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl p-5" style={CARD_STYLE}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
                    <span className="text-lg">🔥</span> Sequência atual
                  </div>
                  <div className="mt-2 text-4xl font-bold" style={{ color: EMERALD_LIGHT }}>
                    {currentStreak}
                    <span className="ml-1 text-base font-medium" style={{ color: MUTED }}>dias</span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: MUTED }}>Melhor sequência: {bestStreak} dias</div>
                </div>

                <div className="rounded-2xl p-5" style={CARD_STYLE}>
                  <div className="text-sm" style={{ color: MUTED }}>Este mês</div>
                  <div className="mt-2 text-4xl font-bold" style={{ color: EMERALD_LIGHT }}>
                    {doneDays}
                    <span className="ml-1 text-base font-medium" style={{ color: MUTED }}>/{scheduledDays} dias</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${monthPct}%`, background: `linear-gradient(90deg, ${EMERALD}, ${EMERALD_LIGHT})` }}
                    />
                  </div>
                  <div className="mt-1 text-xs" style={{ color: MUTED }}>{monthPct}% da meta mensal</div>
                </div>

                <div className="rounded-2xl p-5 flex flex-col items-center" style={CARD_STYLE}>
                  <div className="self-start text-sm" style={{ color: MUTED }}>Taxa de sucesso</div>
                  <SuccessRateRing pct={successRate} />
                  <div className="mt-1 text-xs text-center" style={{ color: MUTED }}>
                    {successRate >= 70 ? 'Ótimo trabalho!' : successRate >= 40 ? 'Continue assim!' : 'Vamos melhorar!'}
                  </div>
                </div>
              </div>

              <section className="rounded-2xl p-6" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Frequência semanal</h3>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 bg-white/5 hover:bg-white/10 transition-colors"
                    style={{ color: MUTED }}
                  >
                    Últimas 4 semanas <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <div className="h-[220px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyFrequency} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="streakAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={EMERALD} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="label"
                        stroke={MUTED}
                        tick={{ fill: MUTED, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke={MUTED}
                        tick={{ fill: MUTED, fontSize: 12 }}
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
                        dot={{ r: 4, stroke: EMERALD, strokeWidth: 2, fill: '#0A0F0A' }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl p-6" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Hábitos de hoje</h3>
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-white"
                    style={{ color: EMERALD_LIGHT }}
                  >
                    <Settings className="size-3.5" /> Gerenciar hábitos
                  </button>
                </div>
                {todayHabits.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: MUTED }}>
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
              <section className="rounded-2xl p-6" style={CARD_STYLE}>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalendarCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                    className="size-7 inline-flex items-center justify-center rounded hover:bg-white/10"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="font-medium first-letter:uppercase">{formatTz(calendarCursor, "MMMM 'de' yyyy")}</div>
                  <button
                    type="button"
                    onClick={() => setCalendarCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                    className="size-7 inline-flex items-center justify-center rounded hover:bg-white/10"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-[10px] mb-1" style={{ color: MUTED }}>
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
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: '#111A11', border: '1px solid rgba(16,185,129,0.3)' }}>
      <div style={{ color: MUTED }}>{label}</div>
      <div className="font-semibold text-white">{payload[0].value}% concluído</div>
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
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
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
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{pct}%</div>
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
    <li className={`rounded-xl transition-colors ${completed ? 'bg-emerald-500/10' : 'bg-white/[0.02]'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-xl shrink-0">{habit.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: completed ? EMERALD_LIGHT : 'white' }}>
            {habit.title}
          </div>
          <div className="text-xs truncate" style={{ color: MUTED }}>
            {scheduleLabel(habit)}
            {habit.scheduled_time ? ` · ${habit.scheduled_time.slice(0, 5)}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          aria-label="Concluir hábito"
          className="size-6 rounded-md border-2 inline-flex items-center justify-center shrink-0 transition-colors"
          style={{ background: completed ? EMERALD : 'transparent', borderColor: completed ? EMERALD : '#374151' }}
        >
          {completed && <Check className="size-4 text-black" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 hover:text-white transition-colors"
          style={{ color: MUTED }}
          aria-label={open ? 'Recolher' : 'Expandir'}
        >
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-11 text-xs" style={{ color: MUTED }}>
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
              isSelected ? 'outline outline-2 outline-white/50 outline-offset-1' : ''
            }`}
            style={isToday ? { boxShadow: `0 0 0 2px #111A11, 0 0 0 4px ${EMERALD_LIGHT}` } : undefined}
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
    <section className="rounded-2xl p-6" style={CARD_STYLE}>
      <h3 className="text-lg font-semibold">Detalhes do dia</h3>
      <p className="mt-1 mb-4 text-sm first-letter:uppercase" style={{ color: MUTED }}>
        {formatTz(dateObj, "EEEE, d 'de' MMMM 'de' yyyy")}
      </p>

      {scheduled.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>Nenhum registro para este dia.</p>
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
                    {h.scheduled_time && <span className="text-xs" style={{ color: MUTED }}>· {h.scheduled_time.slice(0, 5)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notDone.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2" style={{ color: '#EF4444' }}>Não concluídos ({notDone.length})</div>
              <ul className="flex flex-col gap-1.5">
                {notDone.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm text-white/80">
                    <span>❌</span>
                    <span>{h.icon} {h.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 pt-4 border-t border-white/10 text-xs italic text-center" style={{ color: MUTED }}>
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: '#111A11', border: '1px solid rgba(16,185,129,0.2)', color: 'white' }}>
        <DialogHeader>
          <DialogTitle className="text-white">Gerenciar hábitos</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label style={{ color: MUTED }}>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Beber água"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label style={{ color: MUTED }}>Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className="size-9 rounded-lg text-lg inline-flex items-center justify-center border transition-colors"
                  style={{
                    borderColor: icon === ic ? EMERALD : 'rgba(255,255,255,0.1)',
                    background: icon === ic ? 'rgba(16,185,129,0.15)' : 'transparent',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label style={{ color: MUTED }}>Dias da semana</Label>
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
                      background: active ? EMERALD : 'rgba(255,255,255,0.05)',
                      color: active ? '#000' : MUTED,
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
            <Label className="cursor-pointer" style={{ color: MUTED }}>Horário opcional</Label>
            {hasTime && (
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-32 bg-white/5 border-white/10 text-white"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm} className="text-white hover:bg-white/10">
                Cancelar edição
              </Button>
            )}
            <Button type="submit" disabled={saving} style={{ background: EMERALD, color: '#000' }} className="hover:opacity-90">
              {editingId ? 'Salvar alterações' : 'Adicionar hábito'}
            </Button>
          </div>
        </form>

        <div className="border-t border-white/10 pt-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
          {habits.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: MUTED }}>Nenhum hábito cadastrado ainda.</p>
          ) : (
            habits.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-lg">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{h.title}</div>
                  <div className="text-xs truncate" style={{ color: MUTED }}>
                    {scheduleLabel(h)}
                    {h.scheduled_time ? ` · ${h.scheduled_time.slice(0, 5)}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => startEdit(h)} className="hover:text-white transition-colors" style={{ color: MUTED }} aria-label="Editar">
                  <Pencil className="size-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(h.id)} className="hover:text-red-400 transition-colors" style={{ color: MUTED }} aria-label="Excluir">
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
