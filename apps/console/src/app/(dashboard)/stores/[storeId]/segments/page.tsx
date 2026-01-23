'use client';

import { Plus, Search, Users } from 'lucide-react';

export default function SegmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Segments</h1>
          <p className="text-gray-400 mt-1">Create dynamic user segments for targeted messaging</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus size={20} />
          <span>New Segment</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search segments..."
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Segments Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Members</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Conditions</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Updated</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <Users className="text-gray-500" size={24} />
                </div>
                <p>No segments yet. Create your first segment to target users.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Segment Builder Preview */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Segment Builder</h2>
        <p className="text-gray-400 mb-4">
          Use our visual builder to create segments based on user attributes, behavior, and custom events.
        </p>
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 font-mono">
            {`{`}<br />
            {`  "match": "all",`}<br />
            {`  "rules": [`}<br />
            {`    { "field": "metrics.total_orders", "op": ">", "value": 0 },`}<br />
            {`    { "field": "device.last_seen_at", "op": "within_last", "value": "30d" }`}<br />
            {`  ]`}<br />
            {`}`}
          </div>
        </div>
      </div>
    </div>
  );
}
