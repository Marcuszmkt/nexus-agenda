import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Calendar as CalendarIcon, Home as HomeIcon, Clock, Flame } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { HistoryButton } from '@/components/history-button'
import { TZ } from '@/lib/tz'

const NAV_TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/calendario', label: 'Calendário', icon: CalendarIcon },
  { to: '/streak', label: 'Streak', icon: Flame },
] as const

const ACCENT_PURPLE = '#7C3AED'
const ACCENT_EMERALD = '#10B981'

function isStreakPath(pathname: string): boolean {
  return pathname.startsWith('/streak')
}

function accentForPath(pathname: string): string {
  return isStreakPath(pathname) ? ACCENT_EMERALD : ACCENT_PURPLE
}

function NexusMark({ isEmerald }: { isEmerald: boolean }) {
  return (
    <span className="relative inline-block h-8 w-8 shrink-0">
      <img
        src="/n-purple.png"
        alt=""
        className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${isEmerald ? 'opacity-0' : 'opacity-100'}`}
      />
      <img
        src="/n-emerald.png"
        alt=""
        className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${isEmerald ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}

function isTabActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

export function AppShell({
  children,
  rightHeader,
}: {
  children: ReactNode
  rightHeader?: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const accent = accentForPath(pathname)

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
      <header className="relative flex items-center gap-3 sm:gap-6 border-b border-border px-3 sm:px-6 py-3 shrink-0 bg-card/80 backdrop-blur-sm dark:bg-[#080808]">
        <div className="flex items-center gap-2">
          <NexusMark isEmerald={isStreakPath(pathname)} />
          <h1 className="hidden sm:block text-base font-semibold tracking-tight text-foreground">
            Nexus
          </h1>
        </div>

        <nav className="hidden lg:flex items-center gap-3 text-sm absolute left-1/2 -translate-x-1/2">
          {NAV_TABS.map((t, i) => {
            const active = isTabActive(pathname, t.to)
            return (
              <span key={t.to} className="flex items-center gap-3">
                {i > 0 && <span className="text-muted-foreground/30">|</span>}
                <Link
                  to={t.to}
                  className={`pb-0.5 border-b-2 font-medium transition-colors duration-200 ${
                    active ? '' : 'border-transparent text-muted-foreground hover:text-foreground/80'
                  }`}
                  style={active ? { color: accent, borderColor: accent } : undefined}
                >
                  {t.label}
                </Link>
              </span>
            )
          })}
        </nav>

        <div className="flex-1" />

        {rightHeader}

        <HistoryButton />

        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          <span>{TZ}</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      <nav className="flex lg:hidden items-center justify-around border-t border-border bg-card/80 backdrop-blur-sm dark:bg-[#080808] shrink-0 py-2">
        {NAV_TABS.map((t) => {
          const active = isTabActive(pathname, t.to)
          return (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors duration-200"
              style={{ color: active ? accent : undefined }}
            >
              <t.icon className={`size-5 ${active ? '' : 'text-muted-foreground'}`} />
              <span className={active ? '' : 'text-muted-foreground'}>{t.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
