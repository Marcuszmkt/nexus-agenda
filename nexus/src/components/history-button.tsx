import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Trophy, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/use-tasks'
import { useGoals } from '@/hooks/use-goals'
import { useEvents } from '@/hooks/use-events'
import { retryMissedTask } from '@/lib/tasks'
import { formatTz, toTz, ymd } from '@/lib/tz'
import { toast } from 'sonner'

export function HistoryButton() {
  const [open, setOpen] = useState(false)
  const { data: tasks = [] } = useTasks()
  const { data: goals = [] } = useGoals(2026)
  const { data: events = [] } = useEvents()

  const todayStr = ymd(toTz(new Date()))

  const missedTasks = useMemo(
    () => tasks.filter((t) => !t.completed && (t.missed || t.scheduled_date < todayStr)),
    [tasks, todayStr],
  )
  const missedEvents = useMemo(
    () => events.filter((ev) => !ev.completed && formatTz(ev.end, 'yyyy-MM-dd') < todayStr),
    [events, todayStr],
  )

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.completed)
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)),
    [tasks],
  )
  const completedGoals = useMemo(
    () =>
      goals
        .filter((g) => g.completed)
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [goals],
  )

  const totalMissed = missedTasks.length + missedEvents.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
      >
        <AlertTriangle className="size-4 shrink-0" />
        <span className="hidden sm:inline">Tarefas perdidas</span>
        {totalMissed > 0 && (
          <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full leading-none">
            {totalMissed}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" /> Tarefas perdidas
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="missed">
            <TabsList className="w-full">
              <TabsTrigger value="missed" className="flex-1 gap-1.5">
                Perdidas
                {totalMissed > 0 && (
                  <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                    {totalMissed}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="missed">
              {totalMissed === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum item perdido.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2">
                  {missedTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Tarefa
                        </span>
                        {t.missed_at && (
                          <span className="text-xs text-rose-500/80">
                            {formatTz(new Date(`${t.missed_at}T12:00:00Z`), "d 'de' MMMM")}
                          </span>
                        )}
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 gap-1"
                          onClick={() =>
                            retryMissedTask(t, todayStr)
                              .then(() => toast.success('Tarefa recriada para hoje'))
                              .catch(() => toast.error('Erro ao recriar'))
                          }
                        >
                          <RefreshCw className="size-3" /> Refazer
                        </Button>
                      </div>
                    </li>
                  ))}
                  {missedEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex flex-col gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium leading-snug">{ev.title}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                          Evento
                        </span>
                        <span className="text-xs text-rose-500/80">
                          {formatTz(ev.start, "d 'de' MMMM")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="history">
              {completedTasks.length === 0 && completedGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum item concluído ainda.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2">
                  {completedGoals.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-col gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <Trophy className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium leading-snug">{g.title}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Meta
                        </span>
                        {g.completed_at && (
                          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                            {formatTz(new Date(g.completed_at), "d 'de' MMMM 'de' yyyy")}
                          </span>
                        )}
                        <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
                      </div>
                    </li>
                  ))}
                  {completedTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium line-through opacity-70 leading-snug">
                          {t.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Tarefa
                        </span>
                        <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                          {formatTz(
                            new Date(`${t.scheduled_date}T12:00:00Z`),
                            "d 'de' MMMM 'de' yyyy",
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
