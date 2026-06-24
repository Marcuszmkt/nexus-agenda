import { useEffect, useMemo, useRef } from 'react'
import { useNow } from '@/hooks/use-now'
import { formatTz, toTz } from '@/lib/tz'
import type { CalendarEvent } from '@/lib/events'
import type { AllDayEvent } from '@/lib/all-day-events'
import type { Task } from '@/lib/tasks'
import type { EventModalState } from './EventModal'
import { useMediaQuery } from '@/hooks/use-media-query'

const HOUR_START = 6
const HOUR_END = 23
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START)
const ROW_HEIGHT = 56

interface Props {
  anchorDay: Date
  events: CalendarEvent[]
  allDayEvents?: AllDayEvent[]
  tasks?: Task[]
  onOpenModal: (s: EventModalState) => void
}

function addDaysLocal(day: Date, n: number) {
  const d = new Date(day)
  d.setDate(d.getDate() + n)
  return d
}

export function WeekView({ anchorDay, events, allDayEvents = [], tasks = [], onOpenModal }: Props) {
  const now = useNow(30_000)
  const zonedNow = toTz(now)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const days = useMemo(() => {
    if (isMobile) {
      return [addDaysLocal(anchorDay, -1), anchorDay, addDaysLocal(anchorDay, 1)]
    }
    const dow = anchorDay.getDay()
    const sunday = addDaysLocal(anchorDay, -dow)
    return Array.from({ length: 7 }, (_, i) => addDaysLocal(sunday, i))
  }, [anchorDay, isMobile])

  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollerRef.current) return
    const target = (zonedNow.getHours() - HOUR_START - 1) * ROW_HEIGHT
    scrollerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [anchorDay.toDateString(), isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  const isToday = (d: Date) =>
    d.getFullYear() === zonedNow.getFullYear() &&
    d.getMonth() === zonedNow.getMonth() &&
    d.getDate() === zonedNow.getDate()

  const ymds = days.map((d) => formatTz(d, 'yyyy-MM-dd'))
  const hasAnyDay =
    ymds.some((y) => allDayEvents.some((e) => e.event_date === y)) ||
    ymds.some((y) => tasks.some((t) => t.scheduled_date === y && !t.scheduled_time))

  return (
    <div className="flex flex-col h-full">
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => {
          const today = isToday(d)
          return (
            <div key={d.toISOString()} className={`text-center py-2 ${today ? 'bg-primary/10' : ''}`}>
              <div className="text-xs uppercase text-muted-foreground">{formatTz(d, 'EEE')}</div>
              <div className={`text-lg font-semibold ${today ? 'text-primary' : ''}`}>
                {formatTz(d, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {hasAnyDay && (
        <div
          className="grid border-b border-border bg-muted/30"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="text-[10px] text-muted-foreground text-right pr-2 py-1.5">
            dia inteiro
          </div>
          {ymds.map((ymd) => (
            <div key={ymd} className="flex flex-col gap-0.5 p-1 min-h-7">
              {allDayEvents
                .filter((e) => e.event_date === ymd)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpenModal({ mode: 'edit-all-day', event: e })}
                    className="h-7 rounded px-1.5 text-left text-[11px] text-white truncate hover:opacity-90"
                    style={{ backgroundColor: e.color }}
                  >
                    {e.title}
                  </button>
                ))}
              {tasks
                .filter((t) => t.scheduled_date === ymd && !t.scheduled_time)
                .map((t) => (
                  <div
                    key={t.id}
                    className={`h-7 rounded px-1.5 text-left text-[11px] border border-primary/40 bg-primary/10 text-primary truncate flex items-center ${t.completed ? 'line-through opacity-60' : ''}`}
                    title={t.title}
                  >
                    ✓ {t.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
            height: (HOUR_END - HOUR_START + 1) * ROW_HEIGHT,
          }}
        >
          <div className="relative">
            {HOURS.map((h, idx) => (
              <div
                key={h}
                className="absolute right-2 text-xs text-muted-foreground -mt-2"
                style={{ top: idx * ROW_HEIGHT }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((d, di) => {
            const today = isToday(d)
            const ymd = ymds[di]
            const dayEvents = events.filter((e) => {
              const z = toTz(e.start)
              return (
                z.getFullYear() === d.getFullYear() &&
                z.getMonth() === d.getMonth() &&
                z.getDate() === d.getDate()
              )
            })
            const nowOffset = today
              ? (zonedNow.getHours() - HOUR_START + zonedNow.getMinutes() / 60) * ROW_HEIGHT
              : -1

            return (
              <div key={d.toISOString()} className="relative border-l border-border">
                {HOURS.map((h, idx) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      onOpenModal({
                        mode: 'create',
                        day: d,
                        startTime: `${String(h).padStart(2, '0')}:00`,
                      })
                    }
                    className="absolute left-0 right-0 border-t border-border hover:bg-accent/30 transition-colors"
                    style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                  />
                ))}
                {dayEvents.map((ev) => {
                  const zs = toTz(ev.start)
                  const ze = toTz(ev.end)
                  const startH = zs.getHours() + zs.getMinutes() / 60
                  const endH = ze.getHours() + ze.getMinutes() / 60
                  const top = (startH - HOUR_START) * ROW_HEIGHT
                  const height = Math.max(20, (endH - startH) * ROW_HEIGHT - 2)
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onOpenModal({ mode: 'edit', event: ev })}
                      className="absolute left-1 right-1 rounded px-1.5 py-0.5 text-left text-[11px] text-white shadow-sm hover:opacity-90 transition-opacity overflow-hidden z-[1]"
                      style={{ top, height, backgroundColor: ev.color }}
                    >
                      <div className="font-medium truncate">{ev.title}</div>
                      {height > 30 && (
                        <div className="opacity-90 truncate">{formatTz(ev.start, 'HH:mm')}</div>
                      )}
                    </button>
                  )
                })}
                {tasks
                  .filter((t) => t.scheduled_date === ymd && t.scheduled_time)
                  .map((t) => {
                    const [hh, mm] = t.scheduled_time!.split(':').map(Number)
                    const startH = hh + (mm || 0) / 60
                    const top = (startH - HOUR_START) * ROW_HEIGHT
                    return (
                      <div
                        key={t.id}
                        className={`absolute left-1 right-1 rounded px-1.5 py-0.5 text-[11px] border border-primary/40 bg-primary/10 text-primary overflow-hidden z-[1] ${t.completed ? 'line-through opacity-60' : ''}`}
                        style={{ top, height: ROW_HEIGHT - 4 }}
                        title={t.title}
                      >
                        <div className="font-medium truncate">✓ {t.title}</div>
                        <div className="opacity-80 truncate">{t.scheduled_time!.slice(0, 5)}</div>
                      </div>
                    )
                  })}
                {today && nowOffset >= 0 && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-10"
                    style={{ top: nowOffset }}
                  >
                    <div className="flex items-center">
                      <div className="size-2.5 rounded-full bg-primary -ml-1" />
                      <div className="h-px flex-1 bg-primary" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
