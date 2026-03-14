'use client'

import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarOpen } = useUiStore()

  return (
    <div className="min-h-screen bg-[#050505]">
      <Sidebar />
      <Header />
      <main
        className={cn(
          'pt-16 transition-all duration-300',
          sidebarOpen ? 'ml-56' : 'ml-16',
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
