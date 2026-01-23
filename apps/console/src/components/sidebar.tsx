'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bell,
  Workflow,
  Users,
  BarChart3,
  Settings,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../lib/store';
import { StoreSwitcher } from './store-switcher';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Bell },
  { name: 'Automations', href: '/automations', icon: Workflow },
  { name: 'Segments', href: '/segments', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'App Builder', href: '/app-builder', icon: Smartphone },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, currentStore } = useAppStore();

  // Extract storeId from pathname if present
  const storeId = currentStore?.id;

  return (
    <div
      className={cn(
        'flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-20',
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
        {sidebarOpen && (
          <Link href="/stores" className="text-xl font-bold text-white">
            AppFy
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Store Switcher */}
      <div className="p-4 border-b border-gray-800">
        <StoreSwitcher collapsed={!sidebarOpen} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const href = storeId ? `/stores/${storeId}${item.href}` : item.href;
          const isActive = pathname.includes(item.href);

          return (
            <Link
              key={item.name}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
                !sidebarOpen && 'justify-center',
              )}
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/account"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors',
            !sidebarOpen && 'justify-center',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            U
          </div>
          {sidebarOpen && <span>Account</span>}
        </Link>
      </div>
    </div>
  );
}
