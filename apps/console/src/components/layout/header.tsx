'use client'

import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'
import { TenantSwitcher } from './tenant-switcher'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

export function Header() {
  const { sidebarOpen } = useUiStore()

  return (
    <header
      className={cn(
        'fixed top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-xl px-6 transition-all duration-300',
        sidebarOpen ? 'left-56' : 'left-16',
        'right-0',
      )}
    >
      <TenantSwitcher />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
