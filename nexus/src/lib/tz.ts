import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale'

export const TZ = 'America/Sao_Paulo'

export function nowInTz(): Date {
  return toZonedTime(new Date(), TZ)
}

export function toTz(date: Date): Date {
  return toZonedTime(date, TZ)
}

export function fromTzParts(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const mi = String(minute).padStart(2, '0')
  const iso = `${year}-${mm}-${dd}T${hh}:${mi}:00`
  return fromZonedTime(iso, TZ)
}

export function combineZonedDayAndTime(zonedDay: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return fromTzParts(zonedDay.getFullYear(), zonedDay.getMonth(), zonedDay.getDate(), h, m)
}

export function formatTz(date: Date, fmt: string): string {
  return formatInTimeZone(date, TZ, fmt, { locale: ptBR })
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekEndOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const daysToSun = date.getDay() === 0 ? 0 : 7 - date.getDay()
  return ymd(new Date(y, m - 1, d + daysToSun))
}
