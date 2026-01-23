'use client';

import { Plus, Search, Play, Pause } from 'lucide-react';

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="text-gray-400 mt-1">Create automated workflows triggered by user actions</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus size={20} />
          <span>New Automation</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search automations..."
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Automations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Empty State */}
        <div className="col-span-full bg-gray-900 border border-gray-800 border-dashed rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Play className="text-gray-500" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No automations yet</h3>
          <p className="text-gray-400 mb-4">
            Create your first automation to engage users automatically
          </p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus size={18} />
            <span>Create Automation</span>
          </button>
        </div>
      </div>

      {/* Templates Section */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Welcome Series', description: 'Send a series of onboarding messages' },
            { name: 'Abandoned Cart', description: 'Remind users about items in their cart' },
            { name: 'Win-back', description: 'Re-engage inactive users' },
          ].map((template) => (
            <div
              key={template.name}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <h3 className="text-white font-medium mb-1">{template.name}</h3>
              <p className="text-sm text-gray-400">{template.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
