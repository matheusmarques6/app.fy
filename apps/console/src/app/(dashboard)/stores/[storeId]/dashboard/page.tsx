'use client';

import { useAppStore } from '@/lib/store';
import { BarChart3, Bell, Users, Smartphone } from 'lucide-react';

export default function DashboardPage() {
  const { currentStore } = useAppStore();

  const stats = [
    { name: 'Active Devices', value: '12,345', icon: Smartphone, change: '+12%' },
    { name: 'Push Sent (30d)', value: '45,678', icon: Bell, change: '+8%' },
    { name: 'Active Segments', value: '24', icon: Users, change: '+3' },
    { name: 'Conversion Rate', value: '3.2%', icon: BarChart3, change: '+0.4%' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Overview for {currentStore?.name || 'your store'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <stat.icon className="text-gray-400" size={20} />
              <span className="text-xs text-green-400">{stat.change}</span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Push Performance</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart placeholder - Push sent vs opened over time
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">User Growth</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart placeholder - New devices over time
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-300">
                  Activity event placeholder #{i}
                </span>
              </div>
              <span className="text-xs text-gray-500">{i}h ago</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
