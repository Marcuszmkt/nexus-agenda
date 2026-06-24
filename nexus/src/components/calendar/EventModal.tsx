import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  EVENT_COLORS,
  createEvent,
  deleteEvent,
  updateEvent,
  type CalendarEvent,
  type EventPriority,
} from '@/lib/events'
import {
  createAllDayEvent,
  deleteAllDayEvent,
  updateAllDayEvent,
  type AllDayEvent,
} from '@/lib/all-day-events'
import { combineZonedDayAndTime, formatTz, toTz } from '@/lib/tz'

export type EventModalState =
  | { mode: 'create'; day: Date; startTime?: string; allDay?: boolean }
  | { mode: 'edit'; event: CalendarEvent }
  | { mode: 'edit-all-day'; event: AllDayEvent }
  | null

interface Props {
  state: EventModalState
  onClose: () => void
}

export function EventModal({ state, onClose }: Props) {
  const open = state !== null
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(EVENT_COLORS[0])
  const [priority, setPriority] = useState<EventPriority>('common')
  const [allDay, setAllDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!state) {
      initialized.current = false
      return
    }
    if (initialized.current) return
    initialized.current = true

    if (state.mode === 'create') {
      setTitle('')
      setDescription('')
      setColor(EVENT_COLORS[0])
      setPriority('common')
      setAllDay(!!state.allDay)
      setDate(formatTz(state.day, 'yyyy-MM-dd'))
      const s = state.startTime ?? '09:00'
      setStartTime(s)
      const [h, m] = s.split(':').map(Number)
      const endH = Math.min(h + 1, 23)
      setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    } else if (state.mode === 'edit') {
      const ev = state.event
      setTitle(ev.title)
      setDescription(ev.description ?? '')
      setColor(ev.color)
      setPriority(ev.priority)
      setAllDay(false)
      setDate(formatTz(ev.start, 'yyyy-MM-dd'))
      setStartTime(formatTz(ev.start, 'HH:mm'))
      setEndTime(formatTz(ev.end, 'HH:mm'))
    } else {
      const ev = state.event
      setTitle(ev.title)
      setDescription('')
      setColor(ev.color)
      setPriority('common')
      setAllDay(true)
      setDate(ev.event_date)
    }
  }, [state])

  if (!state) return null

  async function handleSave() {
    if (!title.trim()) {
      toast.error('O título é obrigatório')
      return
    }
    setSaving(true)
    try {
      if (allDay) {
        const payload = { title: title.trim(), event_date: date, color }
        if (state!.mode === 'edit-all-day') {
          await updateAllDayEvent(state!.event.id, payload)
          toast.success('Evento atualizado')
        } else {
          await createAllDayEvent(payload)
          toast.success('Evento criado')
        }
      } else {
        if (endTime <= startTime) {
          toast.error('A hora de término deve ser depois da hora de início')
          setSaving(false)
          return
        }
        const [y, mo, d] = date.split('-').map(Number)
        const zonedDay = toTz(new Date(Date.UTC(y, mo - 1, d, 12)))
        const start = combineZonedDayAndTime(zonedDay, startTime)
        const end = combineZonedDayAndTime(zonedDay, endTime)
        const payload = {
          title: title.trim(),
          description: description.trim() || null,
          start,
          end,
          color,
          priority,
        }
        if (state!.mode === 'edit') {
          await updateEvent(state!.event.id, payload)
          toast.success('Evento atualizado')
        } else {
          await createEvent(payload)
          toast.success('Evento criado')
        }
      }
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar evento')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!state || state.mode === 'create') return
    setSaving(true)
    try {
      if (state.mode === 'edit') await deleteEvent(state.event.id)
      else await deleteAllDayEvent(state.event.id)
      toast.success('Evento removido')
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao remover evento')
    } finally {
      setSaving(false)
    }
  }

  const isEdit = state.mode === 'edit' || state.mode === 'edit-all-day'
  const canToggleAllDay = state.mode === 'create'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={
          isMobile
            ? 'h-screen max-h-screen w-screen max-w-none rounded-none p-6 flex flex-col gap-4'
            : 'sm:max-w-md'
        }
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-title">Título *</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunião, almoço..."
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="ev-allday" className="cursor-pointer">
              Dia inteiro
            </Label>
            <Switch
              id="ev-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
              disabled={!canToggleAllDay}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-date">Data</Label>
            <Input
              id="ev-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-start">Início</Label>
                <Input
                  id="ev-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-end">Fim</Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {!allDay && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev-desc">Descrição</Label>
                <Textarea
                  id="ev-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Prioridade</Label>
                <div className="inline-flex rounded-lg bg-muted p-1 text-xs self-start">
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
                    🔥 Importante
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex !flex-row items-center justify-between gap-2 mt-auto sm:mt-0">
          {isEdit ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] hover:opacity-90"
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
