'use client';

import { Plus, Search, Filter } from 'lucide-react';

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Schedule and manage push notifications</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus size={20} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
          <Filter size={18} />
          <span>Filter</span>
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Segment</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Scheduled</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Sent</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                No campaigns yet. Create your first campaign to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
