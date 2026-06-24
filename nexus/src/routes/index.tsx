import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Trophy,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Circle,
  Target,
  ArrowRight,
  Minus,
  Flame,
  Pencil,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { useTasks } from '@/hooks/use-tasks'
import { useGoals } from '@/hooks/use-goals'
import { useEvents } from '@/hooks/use-events'
import { useAllDayEvents } from '@/hooks/use-all-day-events'
import { useNow } from '@/hooks/use-now'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  deleteTask,
  toggleTask,
  postponeTask,
  postponeAllTasks,
  createTask,
  createRecurringTasks,
  markMissedTasks,
  retryMissedTask,
  type Task,
  type TaskPriority,
} from '@/lib/tasks'
import {
  createGoal,
  updateGoal,
  deleteGoal,
  setGoalProgress,
  toggleGoal,
  goalProgressPct,
  type Goal,
  type GoalType,
} from '@/lib/goals'
import {
  createEvent,
  createRecurringEvents,
  deleteEvent,
  updateEvent,
  postponeEvent,
  postponeAllEvents,
  toggleEvent,
  type CalendarEvent,
  type EventPriority,
} from '@/lib/events'
import { createAllDayEvent, deleteAllDayEvent, updateAllDayEvent, type AllDayEvent } from '@/lib/all-day-events'
import { EventModal, type EventModalState } from '@/components/calendar/EventModal'
import { combineZonedDayAndTime, formatTz, nowInTz, toTz, ymd, addDays } from '@/lib/tz'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function getGreeting(hour: number) {
  if (hour >= 6 && hour < 12) return { text: 'Bom dia', emoji: '☀️' }
  if (hour >= 12 && hour < 18) return { text: 'Boa tarde', emoji: '🌤️' }
  return { text: 'Boa noite', emoji: '🌙' }
}

type Period = 'day' | 'tomorrow' | 'week' | 'month' | 'year'

type TimelineItem =
  | { kind: 'task'; id: string; date: string; time: string | null; sortKey: string; task: Task }
  | { kind: 'event'; id: string; date: string; time: string; sortKey: string; event: CalendarEvent }
  | { kind: 'reminder'; id: string; date: string; time: null; sortKey: string; allDay: AllDayEvent }

function itemPriority(it: TimelineItem): EventPriority {
  if (it.kind === 'task') return (it.task.priority as EventPriority) ?? 'common'
  if (it.kind === 'event') return it.event.priority
  return it.allDay.priority
}

function periodRange(now: Date, p: Period): { from: string; to: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  if (p === 'day') {
    const s = ymd(now)
    return { from: s, to: s }
  }
  if (p === 'tomorrow') {
    const s = ymd(new Date(y, m, d + 1))
    return { from: s, to: s }
  }
  if (p === 'week') {
    const start = new Date(y, m, d - now.getDay())
    const end = new Date(y, m, d - now.getDay() + 6)
    return { from: ymd(start), to: ymd(end) }
  }
  if (p === 'month') {
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return { from: ymd(start), to: ymd(end) }
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

function formatNum(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR')
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const rawNow = useNow(60_000)
  const now = toTz(rawNow)
  const todayStr = ymd(now)
  const hour = now.getHours()
  const greeting = mounted ? getGreeting(hour) : { text: 'Olá', emoji: '👋' }

  const { data: tasks = [] } = useTasks()
  const { data: goals = [] } = useGoals(2026)
  const { data: events = [] } = useEvents()
  const { data: allDayEvents = [] } = useAllDayEvents()

  const todayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === todayStr), [tasks, todayStr])
  const todayEvents = useMemo(
    () => events.filter((ev) => formatTz(ev.start, 'yyyy-MM-dd') === todayStr),
    [events, todayStr],
  )

  const totalToday = todayTasks.length + todayEvents.length
  const completedToday =
    todayTasks.filter((t) => t.completed).length +
    todayEvents.filter((ev) => ev.end < rawNow).length

  const importantToday = useMemo(
    () =>
      todayTasks.filter((t) => t.priority === 'important').length +
      todayEvents.filter((ev) => ev.priority === 'important').length,
    [todayTasks, todayEvents],
  )
  const commonToday = useMemo(
    () =>
      todayTasks.filter((t) => t.priority !== 'important').length +
      todayEvents.filter((ev) => ev.priority !== 'important').length,
    [todayTasks, todayEvents],
  )

  const todayAllDay = useMemo(
    () => allDayEvents.filter((e) => e.event_date === todayStr),
    [allDayEvents, todayStr],
  )

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((ev) => ev.end.getTime() >= rawNow.getTime())
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, rawNow],
  )
  const nextEvent = upcomingEvents[0]
  const completedGoals = goals.filter((g) => g.completed).length

  const missedTasks = useMemo(() => tasks.filter((t) => t.missed), [tasks])

  useEffect(() => {
    const overdue = tasks.filter(
      (t) => t.scheduled_date < todayStr && !t.completed && !t.missed,
    )
    if (overdue.length > 0) {
      markMissedTasks(overdue.map((t) => ({ id: t.id, scheduled_date: t.scheduled_date }))).catch(
        console.error,
      )
    }
  }, [tasks, todayStr])

  const [period, setPeriod] = useState<Period>('day')
  const range = useMemo(() => periodRange(now, period), [now, period])

  const timelineItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = []
    for (const t of tasks) {
      if (t.missed) continue
      if (t.scheduled_date < range.from || t.scheduled_date > range.to) continue
      const time = t.scheduled_time ? t.scheduled_time.slice(0, 5) : null
      items.push({
        kind: 'task',
        id: t.id,
        date: t.scheduled_date,
        time,
        sortKey: `${t.scheduled_date} ${time ?? '99:99'}`,
        task: t,
      })
    }
    for (const ev of events) {
      const d = formatTz(ev.start, 'yyyy-MM-dd')
      if (d < range.from || d > range.to) continue
      const time = formatTz(ev.start, 'HH:mm')
      items.push({ kind: 'event', id: ev.id, date: d, time, sortKey: `${d} ${time}`, event: ev })
    }
    for (const a of allDayEvents) {
      if (a.event_date < range.from || a.event_date > range.to) continue
      items.push({
        kind: 'reminder',
        id: a.id,
        date: a.event_date,
        time: null,
        sortKey: `${a.event_date} 00:00`,
        allDay: a,
      })
    }
    items.sort((a, b) => {
      if (a.date !== b.date) return a.sortKey.localeCompare(b.sortKey)
      const pa = itemPriority(a) === 'important' ? 0 : 1
      const pb = itemPriority(b) === 'important' ? 0 : 1
      if (pa !== pb) return pa - pb
      return a.sortKey.localeCompare(b.sortKey)
    })
    return items
  }, [tasks, events, allDayEvents, range])

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineItem[]>()
    for (const it of timelineItems) {
      if (!map.has(it.date)) map.set(it.date, [])
      map.get(it.date)!.push(it)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [timelineItems])

  // End of day banner (after 20h)
  const pendingToday = useMemo(
    () =>
      todayTasks.filter((t) => !t.completed).length +
      todayEvents.filter((ev) => !ev.end || ev.end > rawNow).length,
    [todayTasks, todayEvents, rawNow],
  )
  const showBanner = hour >= 20 && pendingToday > 0
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [missedOpen, setMissedOpen] = useState(false)

  async function handlePostponeAll() {
    try {
      const taskIds = todayTasks.filter((t) => !t.completed).map((t) => t.id)
      const evItems = todayEvents.filter((ev) => ev.end > rawNow).map((ev) => ({
        id: ev.id,
        start: ev.start,
        end: ev.end,
      }))
      await Promise.all([
        taskIds.length > 0 ? postponeAllTasks(taskIds, todayStr) : Promise.resolve(),
        evItems.length > 0 ? postponeAllEvents(evItems) : Promise.resolve(),
      ])
      toast.success('Compromissos adiados para amanhã')
      setBannerDismissed(true)
    } catch {
      toast.error('Erro ao adiar')
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-background) 70%, oklch(0.5 0.25 293 / 5%) 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">

          {showBanner && !bannerDismissed && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-5 shrink-0" />
                <span className="text-sm font-medium">
                  Você ainda tem {pendingToday} compromisso{pendingToday !== 1 ? 's' : ''} pendente{pendingToday !== 1 ? 's' : ''} hoje!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" onClick={handlePostponeAll}>
                  Adiar todos para amanhã
                </Button>
                <button type="button" onClick={() => setBannerDismissed(true)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          <section className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3">
                {greeting.text} <span>{greeting.emoji}</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground first-letter:uppercase">
                {formatTz(now, "EEEE, d 'de' MMMM 'de' yyyy")}
              </p>
            </div>
            {missedTasks.length > 0 && (
              <button
                type="button"
                onClick={() => setMissedOpen(true)}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <AlertTriangle className="size-4" />
                {missedTasks.length} não cumprida{missedTasks.length !== 1 ? 's' : ''}
              </button>
            )}
          </section>

          <Dialog open={missedOpen} onOpenChange={setMissedOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="size-5" /> Tarefas não cumpridas
                </DialogTitle>
              </DialogHeader>
              <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {missedTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                    <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {t.missed_at && (
                        <p className="text-xs text-rose-500/80 mt-0.5">
                          Era para {formatTz(new Date(`${t.missed_at}T12:00:00Z`), "d 'de' MMMM")}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-7 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 gap-1"
                      onClick={() =>
                        retryMissedTask(t, todayStr)
                          .then(() => toast.success('Tarefa recriada para hoje'))
                          .catch(() => toast.error('Erro ao recriar'))
                      }
                    >
                      <RefreshCw className="size-3" /> Refazer
                    </Button>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={<CheckCircle2 className="size-5" />}
                  label="Compromissos hoje"
                  value={
                    <div className="flex flex-col">
                      <span className="text-3xl font-bold">
                        <span className="text-primary">{completedToday}</span>
                        <span className="text-muted-foreground">/{totalToday}</span>
                      </span>
                      {(importantToday > 0 || commonToday > 0) && (
                        <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                          {importantToday > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-500">
                              <Flame className="size-3" /> {importantToday} importantes
                            </span>
                          )}
                          {importantToday > 0 && commonToday > 0 && <span>·</span>}
                          {commonToday > 0 && <span>{commonToday} comuns</span>}
                        </span>
                      )}
                    </div>
                  }
                  progress={totalToday ? (completedToday / totalToday) * 100 : 0}
                />
                <StatCard
                  icon={<Clock className="size-5" />}
                  label="Próximo evento"
                  value={
                    nextEvent ? (
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-primary truncate">{nextEvent.title}</span>
                        <span className="text-sm text-muted-foreground">{formatTz(nextEvent.start, "HH'h'mm")}</span>
                      </div>
                    ) : todayAllDay[0] ? (
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-primary truncate">{todayAllDay[0].title}</span>
                        <span className="text-sm text-muted-foreground">Dia inteiro</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum</span>
                    )
                  }
                />
                <StatCard
                  icon={<Target className="size-5" />}
                  label="Metas 2026"
                  value={
                    <span className="text-3xl font-bold">
                      <span className="text-primary">{completedGoals}</span>
                      <span className="text-muted-foreground">/{goals.length}</span>
                    </span>
                  }
                  progress={goals.length ? (completedGoals / goals.length) * 100 : 0}
                />
              </div>

              <AddItemForm todayStr={todayStr} />

              <section className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Resumo</h3>
                  <div className="inline-flex rounded-full bg-muted p-1 text-xs">
                    {(
                      [
                        ['day', 'Hoje'],
                        ['tomorrow', 'Amanhã'],
                        ['week', 'Semana'],
                        ['month', 'Mês'],
                        ['year', 'Ano'],
                      ] as const
                    ).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setPeriod(k)}
                        className={`px-3 py-1 rounded-full transition-colors ${period === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {grouped.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    Nada agendado neste período.
                  </div>
                ) : period === 'day' ? (
                  <ul className="flex flex-col">
                    {(grouped[0]?.[1] ?? []).map((item) => (
                      <TimelineRow key={`${item.kind}-${item.id}`} item={item} todayStr={todayStr} />
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col gap-5">
                    {grouped.map(([date, items]) => (
                      <div key={date}>
                        <div className="text-xs font-semibold text-primary mb-1 first-letter:uppercase">
                          {formatTz(new Date(`${date}T12:00:00Z`), "EEEE, d 'de' MMMM")}
                        </div>
                        <ul className="flex flex-col">
                          {items.map((item) => (
                            <TimelineRow key={`${item.kind}-${item.id}`} item={item} todayStr={todayStr} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6">
              <NextEventCard event={nextEvent} allDayToday={todayAllDay[0]} now={rawNow} />
              <GoalsCard goals={goals} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

/* ---- Stat Card ---- */

function StatCard({
  icon,
  label,
  value,
  progress,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  progress?: number
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur p-6 shadow-[0_4px_20px_-8px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_28px_-8px_rgba(124,58,237,0.4)] transition-shadow">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <div className="size-9 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center">
          {icon}
        </div>
        <span>{label}</span>
      </div>
      <div className="mt-3">{value}</div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] shadow-[0_0_8px_rgba(124,58,237,0.6)] transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/* ---- Timeline Row ---- */

function TimelineRow({ item, todayStr }: { item: TimelineItem; todayStr: string }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTask = item.kind === 'task'
  const isEvent = item.kind === 'event'
  const completed = isTask ? item.task.completed : isEvent ? item.event.completed : false
  const title =
    item.kind === 'task'
      ? item.task.title
      : item.kind === 'event'
        ? item.event.title
        : item.allDay.title
  const priority = itemPriority(item)

  const tagLabel = item.kind === 'task' ? 'Tarefa' : item.kind === 'event' ? 'Evento' : 'Lembrete'
  const tagClass =
    item.kind === 'task'
      ? 'bg-primary/15 text-primary'
      : item.kind === 'event'
        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
        : 'bg-muted text-muted-foreground'

  async function handlePostpone() {
    try {
      if (item.kind === 'task') {
        await postponeTask(item.task.id, item.task.scheduled_date)
      } else if (item.kind === 'event') {
        await postponeEvent(item.event.id, item.event.start, item.event.end)
      }
      toast.success('Adiado para amanhã')
    } catch {
      toast.error('Erro ao adiar')
    }
  }

  const [editModal, setEditModal] = useState<EventModalState>(null)

  async function handleDelete() {
    try {
      if (item.kind === 'task') await deleteTask(item.task.id)
      else if (item.kind === 'event') await deleteEvent(item.event.id)
      else await deleteAllDayEvent(item.allDay.id)
      toast.success('Removido')
    } catch {
      toast.error('Erro ao remover')
    }
  }

  function handleEdit() {
    if (item.kind === 'event') setEditModal({ mode: 'edit', event: item.event })
    else if (item.kind === 'reminder') setEditModal({ mode: 'edit-all-day', event: item.allDay })
  }

  const canPostpone = (isTask || isEvent) && item.date === todayStr
  const canEdit = isEvent || item.kind === 'reminder'

  return (
    <>
      <li
        className={`group flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg border-b border-border/40 last:border-0 hover:bg-accent/30 transition-colors ${
          priority === 'important' ? 'border-l-2 border-l-amber-500 pl-3 bg-amber-500/5' : ''
        }`}
      >
        <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {item.time ?? '--:--'}
        </span>

        {isTask ? (
          <button
            type="button"
            onClick={() => toggleTask(item.task.id, !item.task.completed).catch(() => toast.error('Erro'))}
            className="text-primary hover:scale-110 transition-transform shrink-0"
            aria-label="Concluir"
          >
            {completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
          </button>
        ) : item.kind === 'event' ? (
          <button
            type="button"
            onClick={() => toggleEvent(item.event.id, !item.event.completed).catch(() => toast.error('Erro'))}
            className="hover:scale-110 transition-transform shrink-0"
            aria-label="Concluir evento"
            style={{ color: item.event.color }}
          >
            {item.event.completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
          </button>
        ) : (
          <div className="size-5 shrink-0" />
        )}

        <span className={`flex-1 text-sm truncate flex items-center gap-1.5 ${completed ? 'line-through opacity-60' : ''}`}>
          {priority === 'important' && <Flame className="size-3.5 text-amber-500 shrink-0" />}
          {title}
        </span>

        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 ${tagClass}`}>{tagLabel}</span>

        <div className={`flex items-center gap-1 ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {canPostpone && (
            <button
              type="button"
              onClick={handlePostpone}
              title="Adiar para amanhã"
              className="text-muted-foreground hover:text-primary text-base leading-none"
            >
              ➡️
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleEdit}
              className="text-muted-foreground hover:text-primary"
              aria-label="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Excluir"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </li>

      <EventModal state={editModal} onClose={() => setEditModal(null)} />
    </>
  )
}

/* ---- Add Item Form ---- */

type Category = 'task' | 'event' | 'reminder'
type DateMode = 'today' | 'tomorrow' | 'week' | 'custom'
type Frequency = 'daily' | 'weekly' | 'monthly'

function thisWeekEnd(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const daysToSat = (6 - date.getDay() + 7) % 7
  const sat = new Date(y, m - 1, d + (daysToSat || 7))
  return ymd(sat)
}

function AddItemForm({ todayStr }: { todayStr: string }) {
  const [expanded, setExpanded] = useState(false)
  const [category, setCategory] = useState<Category>('task')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [dateMode, setDateMode] = useState<DateMode>('today')
  const [customDate, setCustomDate] = useState(todayStr)
  const [hasTime, setHasTime] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [priority, setPriority] = useState<TaskPriority>('common')
  const [repeat, setRepeat] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [repeatEnd, setRepeatEnd] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return ymd(d)
  })
  const [saving, setSaving] = useState(false)

  function resolveDate(): string {
    if (dateMode === 'today') return todayStr
    if (dateMode === 'tomorrow') {
      const [y, m, d] = todayStr.split('-').map(Number)
      return ymd(new Date(y, m - 1, d + 1))
    }
    if (dateMode === 'week') return todayStr
    return customDate
  }

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Descreva o item')
      return
    }
    setSaving(true)
    try {
      const date = resolveDate()
      const isWeekMode = dateMode === 'week' && category !== 'reminder'
      const effectiveRepeat = repeat || isWeekMode
      const effectiveFrequency: Frequency = isWeekMode ? 'daily' : frequency
      const effectiveRepeatEnd = isWeekMode ? thisWeekEnd(todayStr) : repeatEnd

      if (category === 'reminder') {
        await createAllDayEvent({ title: title.trim(), event_date: date })
        toast.success('Lembrete adicionado')
      } else if (category === 'task') {
        const time = hasTime ? startTime : null
        if (effectiveRepeat) {
          await createRecurringTasks({
            title: title.trim(),
            startDate: date,
            endDate: effectiveRepeatEnd,
            scheduled_time: time,
            priority: priority as TaskPriority,
            frequency: effectiveFrequency,
            weekDays: effectiveFrequency === 'weekly' ? weekDays : undefined,
          })
          toast.success(isWeekMode ? 'Tarefa adicionada para toda a semana' : 'Tarefas recorrentes criadas')
        } else {
          await createTask({ title: title.trim(), scheduled_date: date, scheduled_time: time, priority: priority as TaskPriority })
          toast.success('Tarefa adicionada')
        }
      } else {
        // event
        if (!startTime || !endTime) {
          toast.error('Informe horário de início e fim')
          setSaving(false)
          return
        }
        const [y, mo, d] = date.split('-').map(Number)
        const zonedDay = toTz(new Date(Date.UTC(y, mo - 1, d, 12)))
        const start = combineZonedDayAndTime(zonedDay, startTime)
        const end = combineZonedDayAndTime(zonedDay, endTime)
        if (effectiveRepeat) {
          await createRecurringEvents({
            title: title.trim(),
            description: null,
            startDate: date,
            endDate: effectiveRepeatEnd,
            startTime,
            endTime,
            color: '#7C3AED',
            priority: priority as EventPriority,
            frequency: effectiveFrequency,
            weekDays: effectiveFrequency === 'weekly' ? weekDays : undefined,
          })
          toast.success(isWeekMode ? 'Evento adicionado para toda a semana' : 'Eventos recorrentes criados')
        } else {
          await createEvent({ title: title.trim(), start, end, color: '#7C3AED', priority: priority as EventPriority })
          toast.success('Evento adicionado')
        }
      }

      setTitle('')
      setExpanded(false)
      setRepeat(false)
      setHasTime(false)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      toast.error('Erro ao adicionar')
    } finally {
      setSaving(false)
    }
  }

  const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white hover:opacity-90 transition shadow-[0_0_12px_rgba(124,58,237,0.5)] shrink-0"
          aria-label="Expandir"
        >
          <Plus className={`size-4 transition-transform ${expanded ? 'rotate-45' : ''}`} />
        </button>
        <Textarea
          ref={textareaRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); autoResize() }}
          onFocus={() => setExpanded(true)}
          placeholder="Adicionar tarefa, evento ou lembrete..."
          rows={2}
          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-base resize-none min-h-[44px]"
        />
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border/50 pt-4">
          {/* Category */}
          <div className="inline-flex rounded-lg bg-muted p-1 text-xs self-start">
            {(['task', 'event', 'reminder'] as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-md transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {c === 'task' ? 'Tarefa' : c === 'event' ? 'Evento' : 'Lembrete'}
              </button>
            ))}
          </div>

          {/* Date */}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground w-full sm:w-auto">Data</Label>
            <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
              {(['today', 'tomorrow', 'week', 'custom'] as DateMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDateMode(m)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${dateMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {m === 'today' ? 'Hoje' : m === 'tomorrow' ? 'Amanhã' : m === 'week' ? 'Esta semana' : 'Escolher'}
                </button>
              ))}
            </div>
            {dateMode === 'custom' && (
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="w-auto" />
            )}
          </div>

          {/* Time */}
          {category === 'task' && (
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Horário</Label>
              <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setHasTime(false)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${!hasTime ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Sem horário
                </button>
                <button
                  type="button"
                  onClick={() => setHasTime(true)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${hasTime ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Com horário
                </button>
              </div>
              {hasTime && (
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-32" />
              )}
            </div>
          )}
          {category === 'event' && (
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Horário *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-32" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-32" />
            </div>
          )}

          {/* Priority (task/event only) */}
          {category !== 'reminder' && (
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPriority('common')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${priority === 'common' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  Comum
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('important')}
                  className={`px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1 ${priority === 'important' ? 'bg-amber-500 text-white' : 'text-muted-foreground'}`}
                >
                  <Flame className="size-3" /> Importante 🔥
                </button>
              </div>
            </div>
          )}

          {/* Repeat toggle (task/event only) */}
          {category !== 'reminder' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch id="repeat" checked={repeat} onCheckedChange={setRepeat} />
                <Label htmlFor="repeat" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" /> Repetir
                </Label>
              </div>

              {repeat && (
                <div className="flex flex-col gap-3 pl-2 border-l-2 border-primary/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Frequência</Label>
                    <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
                      {(['daily', 'weekly', 'monthly'] as Frequency[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFrequency(f)}
                          className={`px-3 py-1.5 rounded-md transition-colors ${frequency === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                        >
                          {f === 'daily' ? 'Diário' : f === 'weekly' ? 'Semanal' : 'Mensal'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {frequency === 'weekly' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground w-full">Dias da semana</Label>
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setWeekDays((prev) =>
                              prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
                            )
                          }
                          className={`size-8 rounded-full text-xs font-medium transition-colors ${weekDays.includes(idx) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                        >
                          {label[0]}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Input type="date" value={repeatEnd} onChange={(e) => setRepeatEnd(e.target.value)} className="w-auto" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !title.trim()} className="gap-1 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-90">
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

/* ---- Next Event Card ---- */

function NextEventCard({
  event,
  allDayToday,
  now,
}: {
  event: CalendarEvent | undefined
  allDayToday: AllDayEvent | undefined
  now: Date
}) {
  const rawNow = useNow(60_000)

  if (allDayToday) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-6 shadow-sm">
        <h3 className="text-sm text-muted-foreground mb-3">Próximo evento em destaque</h3>
        <div
          className="rounded-2xl p-6 text-white"
          style={{
            background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #9F67FA 100%)',
            border: '1px solid #A78BFA',
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-[#7C3AED] inline-flex items-center justify-center shadow-inner">
                <CalendarIcon className="size-5 text-white" />
              </div>
              <div className="text-2xl font-bold leading-tight">{allDayToday.title}</div>
            </div>
            <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-white/20 text-white">
              Hoje
            </span>
          </div>
          <div className="mt-3 text-sm text-white/80">Dia inteiro</div>
          <Link to="/calendario" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-medium px-3 py-2">
            Ver no calendário <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    )
  }

  if (!event) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 shadow-sm">
        <h3 className="text-sm text-muted-foreground mb-3">Próximo evento em destaque</h3>
        <p className="text-sm text-muted-foreground">Nenhum evento futuro. Aproveite para planejar 🌱</p>
      </section>
    )
  }

  const diffMin = Math.max(0, Math.round((event.start.getTime() - rawNow.getTime()) / 60000))
  const inLabel =
    diffMin < 60
      ? `Em ${diffMin}min`
      : diffMin < 60 * 24
        ? `Em ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
        : `Em ${Math.floor(diffMin / (60 * 24))}d`

  return (
    <section className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-6 shadow-sm">
      <h3 className="text-sm text-muted-foreground mb-3">Próximo evento em destaque</h3>
      <div
        className="rounded-2xl p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #9F67FA 100%)',
          border: '1px solid #A78BFA',
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-[#7C3AED] inline-flex items-center justify-center shadow-inner">
              <CalendarIcon className="size-5 text-white" />
            </div>
            <div className="text-2xl font-bold leading-tight">{event.title}</div>
          </div>
          <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-white/20 text-white">
            {inLabel}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/90">
          <Clock className="size-4" />
          {formatTz(event.start, 'HH:mm')} - {formatTz(event.end, 'HH:mm')}
        </div>
        {event.description && (
          <div className="mt-1 text-sm text-white/80 truncate">{event.description}</div>
        )}
        <Link to="/calendario" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-medium px-3 py-2">
          Ver no calendário <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}

/* ---- Goals Card ---- */

function GoalsCard({ goals }: { goals: Goal[] }) {
  const [allOpen, setAllOpen] = useState(false)
  const active = goals.filter((g) => !g.completed)
  const done = goals.filter((g) => g.completed)

  return (
    <section className="rounded-2xl border border-primary/15 bg-card/60 backdrop-blur p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Metas de 2026</h3>
        </div>
        <div className="flex items-center gap-1">
          {goals.length > 0 && (
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setAllOpen(true)}>
              Ver todas
            </Button>
          )}
          <AddGoalDialog />
        </div>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Crie sua primeira meta para 2026.</p>
      ) : (
        <ul className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1">
          {active.map((g) => <GoalRow key={g.id} goal={g} />)}
          {done.length > 0 && active.length > 0 && (
            <li className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">Concluídas</li>
          )}
          {done.map((g) => <GoalRow key={g.id} goal={g} />)}
        </ul>
      )}

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Todas as metas de 2026</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Ativas ({active.length})</TabsTrigger>
              <TabsTrigger value="done" className="gap-1.5">
                Concluídas
                {done.length > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                    {done.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta ativa.</p>
              ) : (
                <ul className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1 mt-2">
                  {active.map((g) => <GoalRow key={g.id} goal={g} />)}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="done">
              {done.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta concluída ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 mt-2">
                  {done.map((g) => (
                    <li key={g.id} className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-through opacity-70">{g.title}</p>
                        {g.completed_at && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Concluída em {formatTz(new Date(g.completed_at), "d 'de' MMMM 'de' yyyy")}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const pct = goalProgressPct(goal)
  const done = goal.completed || pct >= 100
  const barColor = done ? 'from-emerald-500 to-emerald-400' : 'from-[#7C3AED] to-[#A78BFA]'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(goal.current_value))
  const [editOpen, setEditOpen] = useState(false)

  async function inc(delta: number) {
    await setGoalProgress(goal.id, goal.current_value + delta, goal.target_value).catch(() =>
      toast.error('Erro'),
    )
  }
  async function commit() {
    const n = Number(draft)
    if (Number.isFinite(n)) {
      await setGoalProgress(goal.id, n, goal.target_value).catch(() => toast.error('Erro'))
    }
    setEditing(false)
  }

  return (
    <li className="group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate ${done ? 'line-through opacity-70' : ''}`}>
              {goal.title}
            </span>
            {done && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
            )}
          </div>
          {goal.type === 'quantity' && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              {editing ? (
                <input
                  type="number"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit() }
                    if (e.key === 'Escape') { setDraft(String(goal.current_value)); setEditing(false) }
                  }}
                  className="w-28 px-2 py-0.5 rounded-md border border-primary bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                />
              ) : (
                <button
                  type="button"
                  title="Clique para digitar o valor"
                  onClick={() => { setDraft(String(goal.current_value)); setEditing(true) }}
                  className="px-2 py-0.5 rounded-md border border-border bg-muted/50 text-foreground text-xs tabular-nums hover:border-primary hover:bg-primary/5 transition-colors min-w-[3rem] text-left"
                >
                  {formatNum(goal.current_value)}
                </button>
              )}
              <span>de {formatNum(goal.target_value)} {goal.unit ?? ''}</span>
            </div>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums shrink-0">{pct}%</span>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
          aria-label="Editar meta"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => deleteGoal(goal.id).catch(() => toast.error('Erro'))}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          aria-label="Excluir meta"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} shadow-[0_0_8px_rgba(124,58,237,0.5)] transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        {goal.type === 'unique' ? (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={goal.completed}
              onCheckedChange={(v) => toggleGoal(goal.id, !!v).catch(() => toast.error('Erro'))}
            />
            Marcar como concluída
          </label>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => inc(-1)}
              className="size-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-accent"
              aria-label="Diminuir"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => inc(1)}
              className="size-7 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
              aria-label="Incrementar"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <EditGoalDialog open={editOpen} onClose={() => setEditOpen(false)} goal={goal} />
    </li>
  )
}

function EditGoalDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal }) {
  const [title, setTitle] = useState(goal.title)
  const [type, setType] = useState<GoalType>(goal.type)
  const [target, setTarget] = useState(String(goal.target_value))
  const [unit, setUnit] = useState(goal.unit ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(goal.title)
      setType(goal.type)
      setTarget(String(goal.target_value))
      setUnit(goal.unit ?? '')
    }
  }, [open, goal])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Dê um nome à meta'); return }
    setSaving(true)
    try {
      await updateGoal(goal.id, {
        title: title.trim(),
        type,
        target_value: type === 'quantity' ? Number(target) || 1 : 1,
        unit: type === 'quantity' ? unit.trim() || null : null,
      })
      toast.success('Meta atualizada')
      onClose()
    } catch {
      toast.error('Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar meta</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-goal-title">Título</Label>
            <Input id="edit-goal-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          {type === 'quantity' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-goal-target">Valor alvo</Label>
                <Input id="edit-goal-target" type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-goal-unit">Unidade</Label>
                <Input id="edit-goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="livros, km..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]">
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---- Add Goal Dialog ---- */

function AddGoalDialog() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<GoalType>('unique')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('10')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Dê um nome à meta'); return }
    setSaving(true)
    try {
      await createGoal({
        title: title.trim(),
        type,
        target_value: type === 'quantity' ? Number(target) || 1 : 1,
        unit: type === 'quantity' ? unit.trim() || null : null,
      })
      setOpen(false)
      setTitle('')
      setTarget('10')
      setUnit('')
      setType('unique')
      toast.success('Meta adicionada')
    } catch {
      toast.error('Erro ao adicionar meta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" className="gap-1 text-primary hover:text-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nova
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType('unique')} className={`rounded-xl border p-3 text-left text-sm transition-colors ${type === 'unique' ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
              <div className="font-semibold">Meta única</div>
              <div className="text-xs text-muted-foreground mt-0.5">Algo que se faz uma vez</div>
            </button>
            <button type="button" onClick={() => setType('quantity')} className={`rounded-xl border p-3 text-left text-sm transition-colors ${type === 'quantity' ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
              <div className="font-semibold">Meta de quantidade</div>
              <div className="text-xs text-muted-foreground mt-0.5">Com número alvo</div>
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">Título</Label>
            <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'unique' ? 'Ex: Ir ao cinema' : 'Ex: Ler 24 livros'} autoFocus />
          </div>
          {type === 'quantity' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-target">Valor alvo</Label>
                <Input id="goal-target" type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-unit">Unidade</Label>
                <Input id="goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="livros, km..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]">
              <Plus className="size-4" /> Criar meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
