import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { AppShell } from '@/components/app-shell'
import { useEvents } from '@/hooks/use-events'
import { useAllDayEvents } from '@/hooks/use-all-day-events'
import { useTasks } from '@/hooks/use-tasks'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatTz, nowInTz, toTz } from '@/lib/tz'
import { createTask, deleteTask, toggleTask } from '@/lib/tasks'
import { DayView } from '@/components/calendar/DayView'
import { WeekView } from '@/components/calendar/WeekView'
import { MonthView } from '@/components/calendar/MonthView'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { EventModal, type EventModalState } from '@/components/calendar/EventModal'

export const Route = createFileRoute('/calendario')({
  component: CalendarPage,
})

type ViewMode = 'day' | 'week' | 'month'

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  return x
}

function CalendarPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [selectedDay, setSelectedDay] = useState<Date>(() => nowInTz())
  const [view, setView] = useState<ViewMode>(isMobile ? 'day' : 'week')
  const [modal, setModal] = useState<EventModalState>(null)
  const { data: events = [] } = useEvents()
  const { data: allDayEvents = [] } = useAllDayEvents()
  const { data: tasks = [] } = useTasks()

  const markDates = useMemo(() => {
    const set = new Set<string>()
    for (const e of allDayEvents) set.add(e.event_date)
    for (const t of tasks) if (!t.scheduled_time) set.add(t.scheduled_date)
    return Array.from(set)
  }, [allDayEvents, tasks])

  const today = formatTz(nowInTz(), 'yyyy-MM-dd')
  const todayTasks = tasks.filter((t) => t.scheduled_date === today)

  const goToday = () => setSelectedDay(nowInTz())
  const goPrev = () => {
    if (view === 'day') setSelectedDay((d) => addDays(d, -1))
    else if (view === 'week') setSelectedDay((d) => addDays(d, isMobile ? -3 : -7))
    else setSelectedDay((d) => addMonths(d, -1))
  }
  const goNext = () => {
    if (view === 'day') setSelectedDay((d) => addDays(d, 1))
    else if (view === 'week') setSelectedDay((d) => addDays(d, isMobile ? 3 : 7))
    else setSelectedDay((d) => addMonths(d, 1))
  }

  const headerTitle = formatTz(selectedDay, "MMMM 'de' yyyy")

  return (
    <AppShell
      rightHeader={
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goNext} aria-label="Próximo">
            <ChevronRight className="size-4" />
          </Button>
          <div className="hidden sm:block ml-2 text-sm font-medium first-letter:uppercase text-muted-foreground">
            {headerTitle}
          </div>
        </div>
      }
    >
      <div className="h-full flex min-h-0">
        {!isMobile && (
          <aside className="w-64 shrink-0 border-r border-border p-4 flex flex-col gap-4 overflow-y-auto">
            <Button
              onClick={() => setModal({ mode: 'create', day: selectedDay })}
              className="gap-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-90"
            >
              <Plus className="size-4" /> Novo evento
            </Button>

            <div className="flex flex-col gap-1">
              {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    view === v ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                  }`}
                >
                  {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <MiniCalendar
                selected={selectedDay}
                onSelect={(d) =>
                  setSelectedDay(
                    toTz(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))),
                  )
                }
                marks={markDates}
              />
            </div>
          </aside>
        )}

        <main className={`flex-1 min-w-0 ${isMobile ? 'pb-16' : ''}`}>
          {view === 'day' && (
            <DayView
              day={selectedDay}
              events={events}
              allDayEvents={allDayEvents}
              tasks={tasks}
              onOpenModal={setModal}
            />
          )}
          {view === 'week' && (
            <WeekView
              anchorDay={selectedDay}
              events={events}
              allDayEvents={allDayEvents}
              tasks={tasks}
              onOpenModal={setModal}
            />
          )}
          {view === 'month' && (
            <MonthView
              anchorDay={selectedDay}
              events={events}
              allDayEvents={allDayEvents}
              tasks={tasks}
              onOpenModal={setModal}
              onPickDay={(d) => {
                setSelectedDay(
                  toTz(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))),
                )
                setView('day')
              }}
            />
          )}
        </main>

        {!isMobile && (
          <aside className="w-[220px] shrink-0 border-l border-border p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tarefas de hoje</h3>
              <QuickTaskButton today={today} />
            </div>
            {todayTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa hoje</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {todayTasks.map((t) => (
                  <li key={t.id} className="group flex items-start gap-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={t.completed}
                      onCheckedChange={(v) =>
                        toggleTask(t.id, !!v).catch(() => toast.error('Erro'))
                      }
                    />
                    <span
                      className={`flex-1 leading-tight ${t.completed ? 'line-through opacity-60' : ''}`}
                    >
                      {t.title}
                      {t.scheduled_time && (
                        <span className="block text-[11px] text-muted-foreground">
                          {t.scheduled_time.slice(0, 5)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id).catch(() => toast.error('Erro'))}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {isMobile && (
        <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-background z-20">
          <div className="grid grid-cols-3">
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`py-3 text-sm font-medium transition-colors ${
                  view === v ? 'text-primary border-t-2 border-primary -mt-px' : 'text-muted-foreground'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </nav>
      )}

      {isMobile && (
        <button
          type="button"
          onClick={() => setModal({ mode: 'create', day: selectedDay })}
          className="fixed bottom-20 right-4 size-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white shadow-lg inline-flex items-center justify-center hover:scale-105 transition-transform z-30"
          aria-label="Novo evento"
        >
          <Plus className="size-6" />
        </button>
      )}

      <EventModal state={modal} onClose={() => setModal(null)} />
    </AppShell>
  )
}

function QuickTaskButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  async function add() {
    if (!val.trim()) return
    try {
      await createTask({ title: val.trim(), scheduled_date: today, scheduled_time: null })
      setVal('')
      setOpen(false)
    } catch {
      toast.error('Erro')
    }
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="size-6 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center hover:bg-primary/20"
        aria-label="Adicionar tarefa"
      >
        <Plus className="size-3.5" />
      </button>
    )
  }
  return (
    <div className="flex gap-1 w-full">
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Nova tarefa"
        className="h-7 text-xs"
      />
    </div>
  )
}
