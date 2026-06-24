import { useEffect, useMemo, useRef } from 'react'
import { useNow } from '@/hooks/use-now'
import { formatTz, toTz } from '@/lib/tz'
import type { CalendarEvent } from '@/lib/events'
import type { AllDayEvent } from '@/lib/all-day-events'
import type { Task } from '@/lib/tasks'
import type { EventModalState } from './EventModal'

const HOUR_START = 6
const HOUR_END = 23
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START)
const ROW_HEIGHT = 56

interface Props {
  day: Date
  events: CalendarEvent[]
  allDayEvents?: AllDayEvent[]
  tasks?: Task[]
  onOpenModal: (s: EventModalState) => void
}

export function DayView({ day, events, allDayEvents = [], tasks = [], onOpenModal }: Props) {
  const now = useNow(30_000)
  const zonedNow = toTz(now)
  const sameDay =
    zonedNow.getFullYear() === day.getFullYear() &&
    zonedNow.getMonth() === day.getMonth() &&
    zonedNow.getDate() === day.getDate()

  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollerRef.current) return
    const target = sameDay
      ? (zonedNow.getHours() - HOUR_START - 1) * ROW_HEIGHT
      : (8 - HOUR_START) * ROW_HEIGHT
    scrollerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [day.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  const ymd = formatTz(day, 'yyyy-MM-dd')

  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const z = toTz(e.start)
      return (
        z.getFullYear() === day.getFullYear() &&
        z.getMonth() === day.getMonth() &&
        z.getDate() === day.getDate()
      )
    })
  }, [events, day])

  const nowOffset = sameDay
    ? (zonedNow.getHours() - HOUR_START + zonedNow.getMinutes() / 60) * ROW_HEIGHT
    : -1

  const todaysEv = allDayEvents.filter((e) => e.event_date === ymd)
  const todaysTasks = tasks.filter((t) => t.scheduled_date === ymd && !t.scheduled_time)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground first-letter:uppercase">
          {formatTz(day, 'EEEE')}
        </div>
        <div className={`text-2xl font-semibold ${sameDay ? 'text-primary' : ''}`}>
          {formatTz(day, "d 'de' MMMM")}
        </div>
      </div>

      {(todaysEv.length > 0 || todaysTasks.length > 0) && (
        <div className="border-b border-border px-4 py-2 flex flex-col gap-1 bg-muted/30">
          {todaysEv.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpenModal({ mode: 'edit-all-day', event: e })}
              className="h-7 rounded px-2 text-left text-xs text-white truncate hover:opacity-90"
              style={{ backgroundColor: e.color }}
            >
              {e.title}
            </button>
          ))}
          {todaysTasks.map((t) => (
            <div
              key={t.id}
              className={`h-7 rounded px-2 text-left text-xs border border-primary/40 bg-primary/10 text-primary truncate flex items-center ${t.completed ? 'line-through opacity-60' : ''}`}
            >
              ✓ {t.title}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: (HOUR_END - HOUR_START + 1) * ROW_HEIGHT }}>
          {HOURS.map((h, idx) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex border-t border-border"
              style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <div className="w-16 shrink-0 -mt-2 pr-2 text-right text-xs text-muted-foreground">
                {String(h).padStart(2, '0')}:00
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenModal({
                    mode: 'create',
                    day,
                    startTime: `${String(h).padStart(2, '0')}:00`,
                  })
                }
                className="flex-1 hover:bg-accent/30 transition-colors cursor-pointer"
              />
            </div>
          ))}

          <div className="absolute left-16 right-2 top-0 bottom-0 pointer-events-none">
            {dayEvents.map((ev) => {
              const zs = toTz(ev.start)
              const ze = toTz(ev.end)
              const startH = zs.getHours() + zs.getMinutes() / 60
              const endH = ze.getHours() + ze.getMinutes() / 60
              const top = (startH - HOUR_START) * ROW_HEIGHT
              const height = Math.max(24, (endH - startH) * ROW_HEIGHT - 2)
              if (top + height < 0 || top > (HOUR_END - HOUR_START + 1) * ROW_HEIGHT) return null
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onOpenModal({ mode: 'edit', event: ev })}
                  className="absolute left-1 right-1 rounded-md px-2 py-1 text-left text-xs text-white shadow-sm pointer-events-auto hover:opacity-90 transition-opacity overflow-hidden"
                  style={{ top, height, backgroundColor: ev.color }}
                >
                  <div className="font-medium truncate">{ev.title}</div>
                  <div className="opacity-90 truncate">
                    {formatTz(ev.start, 'HH:mm')} – {formatTz(ev.end, 'HH:mm')}
                  </div>
                </button>
              )
            })}
            {tasks
              .filter((t) => t.scheduled_date === ymd && t.scheduled_time)
              .map((t) => {
                const [hh, mm] = t.scheduled_time!.split(':').map(Number)
                const startH = hh + (mm || 0) / 60
                const top = (startH - HOUR_START) * ROW_HEIGHT
                if (top < -ROW_HEIGHT || top > (HOUR_END - HOUR_START + 1) * ROW_HEIGHT)
                  return null
                return (
                  <div
                    key={t.id}
                    className={`absolute left-1 right-1 rounded-md px-2 py-1 text-xs border border-primary/40 bg-primary/10 text-primary pointer-events-auto overflow-hidden ${t.completed ? 'line-through opacity-60' : ''}`}
                    style={{ top, height: ROW_HEIGHT - 4 }}
                    title={t.title}
                  >
                    <div className="font-medium truncate">✓ {t.title}</div>
                    <div className="opacity-80 truncate">{t.scheduled_time!.slice(0, 5)}</div>
                  </div>
                )
              })}
          </div>

          {sameDay && nowOffset >= 0 && (
            <div
              className="absolute left-14 right-0 pointer-events-none z-10"
              style={{ top: nowOffset }}
            >
              <div className="flex items-center">
                <div className="size-3 rounded-full bg-primary -ml-1.5" />
                <div className="h-px flex-1 bg-primary" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
