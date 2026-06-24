import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatTz, toTz } from '@/lib/tz'
import { useNow } from '@/hooks/use-now'

interface Props {
  selected: Date
  onSelect: (day: Date) => void
  marks?: string[]
}

function startOfGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const s = new Date(first)
  s.setDate(s.getDate() - first.getDay())
  return s
}

export function MiniCalendar({ selected, onSelect, marks = [] }: Props) {
  const now = useNow(60_000)
  const zonedNow = toTz(now)

  const grid = useMemo(() => {
    const start = startOfGrid(selected)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [selected])

  function changeMonth(n: number) {
    const d = new Date(selected)
    d.setDate(1)
    d.setMonth(d.getMonth() + n)
    onSelect(d)
  }

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="font-medium first-letter:uppercase">{formatTz(selected, 'MMMM yyyy')}</div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="size-7 inline-flex items-center justify-center rounded hover:bg-accent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-muted-foreground mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((c, i) => (
          <div key={i} className="text-center">{c}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((d) => {
          const inMonth = d.getMonth() === selected.getMonth()
          const isSelected =
            d.getFullYear() === selected.getFullYear() &&
            d.getMonth() === selected.getMonth() &&
            d.getDate() === selected.getDate()
          const isToday =
            d.getFullYear() === zonedNow.getFullYear() &&
            d.getMonth() === zonedNow.getMonth() &&
            d.getDate() === zonedNow.getDate()
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const hasMark = marks.includes(dateStr)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={`text-xs size-7 rounded-full inline-flex flex-col items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'border border-primary text-primary'
                    : inMonth
                      ? 'hover:bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span>{d.getDate()}</span>
              {hasMark && (
                <span
                  className={`w-1 h-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
