'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Search, Play, Pause, RefreshCw, MoreVertical, Zap } from 'lucide-react';
import { automationsApi, Automation } from '@/lib/api-client';

export default function AutomationsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { data: session } = useSession();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchAutomations = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const data = await automationsApi.list(session.accessToken, storeId);
      setAutomations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, [session, storeId]);

  const handleToggle = async (automation: Automation) => {
    if (!session?.accessToken) return;

    setToggling(automation.id);
    try {
      await automationsApi.toggle(
        session.accessToken,
        storeId,
        automation.id,
        automation.status !== 'active'
      );
      fetchAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle automation');
    } finally {
      setToggling(null);
    }
  };

  const filteredAutomations = automations.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/50 text-green-300';
      case 'paused':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'draft':
        return 'bg-gray-700 text-gray-400';
      case 'archived':
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  const templates = [
    { name: 'Welcome Series', description: 'Send a series of onboarding messages', event: 'app_open' },
    { name: 'Abandoned Cart', description: 'Remind users about items in their cart', event: 'add_to_cart' },
    { name: 'Win-back', description: 'Re-engage inactive users', event: 'custom' },
  ];

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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={fetchAutomations}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Automations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Zap className="text-gray-500" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {search ? 'No automations match your search' : 'No automations yet'}
          </h3>
          <p className="text-gray-400 mb-4">
            Create your first automation to engage users automatically
          </p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus size={18} />
            <span>Create Automation</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAutomations.map((automation) => (
            <div
              key={automation.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-medium">{automation.name}</h3>
                  {automation.description && (
                    <p className="text-sm text-gray-400 mt-1">{automation.description}</p>
                  )}
                </div>
                <button className="p-1 hover:bg-gray-700 rounded">
                  <MoreVertical size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-sm text-gray-400">{automation.entry_event}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(automation.status)}`}>
                  {automation.status}
                </span>
                <button
                  onClick={() => handleToggle(automation)}
                  disabled={toggling === automation.id}
                  className={`p-2 rounded-lg transition-colors ${
                    automation.status === 'active'
                      ? 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400'
                      : 'bg-green-900/30 hover:bg-green-900/50 text-green-400'
                  } disabled:opacity-50`}
                >
                  {toggling === automation.id ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : automation.status === 'active' ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Section */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.name}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <h3 className="text-white font-medium mb-1">{template.name}</h3>
              <p className="text-sm text-gray-400 mb-2">{template.description}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Zap size={12} />
                <span>Trigger: {template.event}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
