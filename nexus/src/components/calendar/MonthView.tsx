import { useMemo } from 'react'
import { useNow } from '@/hooks/use-now'
import { formatTz, toTz } from '@/lib/tz'
import type { CalendarEvent } from '@/lib/events'
import type { AllDayEvent } from '@/lib/all-day-events'
import type { Task } from '@/lib/tasks'
import type { EventModalState } from './EventModal'
import { useMediaQuery } from '@/hooks/use-media-query'

interface Props {
  anchorDay: Date
  events: CalendarEvent[]
  allDayEvents?: AllDayEvent[]
  tasks?: Task[]
  onOpenModal: (s: EventModalState) => void
  onPickDay: (day: Date) => void
}

function startOfMonthGrid(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const dow = first.getDay()
  const start = new Date(first)
  start.setDate(start.getDate() - dow)
  return start
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MonthView({
  anchorDay,
  events,
  allDayEvents = [],
  tasks = [],
  onOpenModal,
  onPickDay,
}: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const now = useNow(60_000)
  const zonedNow = toTz(now)
  const maxVisible = isMobile ? 1 : 3

  const grid = useMemo(() => {
    const start = startOfMonthGrid(anchorDay)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [anchorDay])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const z = toTz(ev.start)
      const key = toYmd(z)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [events])

  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-border">
        {weekdayLabels.map((w) => (
          <div
            key={w}
            className="text-center text-xs uppercase tracking-wider text-muted-foreground py-2"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {grid.map((d) => {
          const inMonth = d.getMonth() === anchorDay.getMonth()
          const isToday =
            d.getFullYear() === zonedNow.getFullYear() &&
            d.getMonth() === zonedNow.getMonth() &&
            d.getDate() === zonedNow.getDate()
          const dateStr = toYmd(d)
          const dayEvents = eventsByDay.get(dateStr) ?? []
          const visible = dayEvents.slice(0, maxVisible)
          const remaining = dayEvents.length - visible.length
          const dayAllDay = allDayEvents.filter((e) => e.event_date === dateStr)
          const dayTasks = tasks.filter((t) => t.scheduled_date === dateStr)

          return (
            <div
              key={d.toISOString()}
              className={`border-r border-b border-border p-1 flex flex-col gap-0.5 overflow-hidden cursor-pointer hover:bg-accent/20 transition-colors min-h-0 ${inMonth ? '' : 'bg-muted/30'}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-event-btn]')) return
                if (isMobile) onPickDay(d)
                else onOpenModal({ mode: 'create', day: d })
              }}
            >
              <div className="flex justify-end">
                <div
                  className={`text-xs size-6 inline-flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
              <div className="flex flex-col gap-0.5 min-h-0">
                {dayAllDay.slice(0, maxVisible).map((e) => (
                  <button
                    key={e.id}
                    data-event-btn
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation()
                      onOpenModal({ mode: 'edit-all-day', event: e })
                    }}
                    className="text-[10px] sm:text-xs text-left rounded px-1.5 py-0.5 text-white truncate hover:opacity-90"
                    style={{ backgroundColor: e.color }}
                  >
                    {e.title}
                  </button>
                ))}
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    data-event-btn
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenModal({ mode: 'edit', event: ev })
                    }}
                    className="text-[10px] sm:text-xs text-left rounded px-1.5 py-0.5 text-white truncate hover:opacity-90"
                    style={{ backgroundColor: ev.color }}
                  >
                    <span className="hidden sm:inline opacity-90 mr-1">
                      {formatTz(ev.start, 'HH:mm')}
                    </span>
                    {ev.title}
                  </button>
                ))}
                {dayTasks.slice(0, maxVisible).map((t) => (
                  <div
                    key={t.id}
                    className={`text-[10px] sm:text-xs rounded px-1.5 py-0.5 border border-primary/40 bg-primary/10 text-primary truncate ${t.completed ? 'line-through opacity-60' : ''}`}
                    title={t.title}
                  >
                    ✓ {t.title}
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground px-1">
                    +{remaining} mais
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
