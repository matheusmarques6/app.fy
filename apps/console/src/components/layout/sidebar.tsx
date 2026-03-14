'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bell,
  Zap,
  BarChart3,
  Smartphone,
  Plug,
  Users,
  CreditCard,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Notificacoes', href: '/notifications', icon: Bell },
  { label: 'Automacoes', href: '/automations', icon: Zap },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'App', href: '/app', icon: Smartphone },
  { label: 'Integracoes', href: '/integrations', icon: Plug },
  { label: 'Usuarios', href: '/customers', icon: Users },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Configuracoes', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUiStore()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/5 bg-[#050505] transition-all duration-300',
          sidebarOpen ? 'w-56' : 'w-16',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-white/5 px-4">
          {sidebarOpen ? (
            <span className="text-xl font-bold text-gradient-violet">AppFy</span>
          ) : (
            <span className="text-xl font-bold text-violet-400">A</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon

            if (!sidebarOpen) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex h-10 w-full items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-white/5 p-2">
          <button
            onClick={toggleSidebar}
            className="flex h-10 w-full items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-white transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
