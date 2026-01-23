'use client';

import { Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Track performance and user engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            <Calendar size={18} />
            <span>Last 30 days</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: 'Total Users', value: '24,531', change: '+12.3%', positive: true },
          { name: 'Active Users (DAU)', value: '8,234', change: '+5.2%', positive: true },
          { name: 'Push Open Rate', value: '24.5%', change: '-2.1%', positive: false },
          { name: 'Avg Session Duration', value: '4m 32s', change: '+8.7%', positive: true },
        ].map((metric) => (
          <div key={metric.name} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{metric.name}</div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-white">{metric.value}</span>
              <span className={`flex items-center text-sm ${metric.positive ? 'text-green-400' : 'text-red-400'}`}>
                {metric.positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span className="ml-1">{metric.change}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">User Growth</h3>
          <div className="h-72 flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded">
            Chart placeholder - Daily new users
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Push Performance</h3>
          <div className="h-72 flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded">
            Chart placeholder - Sent vs Opened vs Clicked
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Revenue Attribution</h3>
          <div className="h-72 flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded">
            Chart placeholder - Revenue from push campaigns
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Top Events</h3>
          <div className="space-y-3">
            {[
              { name: 'app_open', count: '45,234' },
              { name: 'product_view', count: '32,156' },
              { name: 'add_to_cart', count: '12,456' },
              { name: 'purchase', count: '3,234' },
              { name: 'push_received', count: '28,456' },
            ].map((event) => (
              <div key={event.name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-300 font-mono">{event.name}</span>
                <span className="text-sm text-gray-400">{event.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
