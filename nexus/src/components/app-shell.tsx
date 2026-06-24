import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Calendar as CalendarIcon, Home as HomeIcon, Clock, Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { TZ } from '@/lib/tz'

export function AppShell({
  children,
  rightHeader,
}: {
  children: ReactNode
  rightHeader?: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const tabs = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/calendario', label: 'Calendário', icon: CalendarIcon },
  ]

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 sm:gap-6 border-b border-border px-3 sm:px-6 py-3 shrink-0 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white inline-flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.5)]">
            <Zap className="size-5" />
          </div>
          <h1 className="hidden sm:block text-base font-bold tracking-tight bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] bg-clip-text text-transparent">
            Nexus
          </h1>
        </div>

        <nav className="flex items-center gap-1 rounded-full bg-muted p-1">
          {tabs.map((t) => {
            const active = t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-background text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        {rightHeader}

        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          <span>{TZ}</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
