'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, RefreshCw, RotateCcw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { webhooksApi, WebhookEvent } from '@/lib/api-client';

export default function WebhooksPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { data: session } = useSession();

  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [provider, setProvider] = useState<'shopify' | 'woocommerce' | ''>('');
  const [status, setStatus] = useState<'received' | 'processing' | 'processed' | 'failed' | ''>('');
  const [stats, setStats] = useState<{
    total: number;
    by_status: Record<string, number>;
    by_provider: Record<string, number>;
    success_rate: number;
    recent_failures: WebhookEvent[];
  } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [eventsRes, statsRes] = await Promise.all([
        webhooksApi.list(session.accessToken, storeId, {
          page,
          limit: 20,
          provider: provider || undefined,
          status: status || undefined,
        }),
        webhooksApi.getStats(session.accessToken, storeId),
      ]);

      setEvents(eventsRes.data);
      setTotalPages(eventsRes.pagination.total_pages);
      setTotal(eventsRes.pagination.total);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, [session, storeId, page, provider, status]);

  const handleRetry = async (eventId: string) => {
    if (!session?.accessToken) return;

    setRetrying(eventId);
    try {
      await webhooksApi.retry(session.accessToken, storeId, eventId);
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry webhook');
    } finally {
      setRetrying(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      case 'processing':
        return <RefreshCw size={16} className="text-blue-400 animate-spin" />;
      default:
        return <Clock size={16} className="text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-green-900/50 text-green-300';
      case 'failed':
        return 'bg-red-900/50 text-red-300';
      case 'processing':
        return 'bg-blue-900/50 text-blue-300';
      default:
        return 'bg-yellow-900/50 text-yellow-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-gray-400 mt-1">Monitor incoming webhooks from Shopify and WooCommerce</p>
        </div>
        <button
          onClick={fetchWebhooks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Events</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Processed</p>
            <p className="text-2xl font-bold text-green-400 mt-1">
              {(stats.by_status['processed'] || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Failed</p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {(stats.by_status['failed'] || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Success Rate</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.success_rate}%</p>
          </div>
        </div>
      )}

      {/* Recent Failures Alert */}
      {stats && stats.recent_failures.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-400" />
            <span className="text-red-400 font-medium">Recent Failures</span>
          </div>
          <div className="space-y-2">
            {stats.recent_failures.slice(0, 3).map((failure) => (
              <div key={failure.id} className="text-sm text-gray-400">
                <span className="text-red-300">{failure.topic}</span> - {failure.last_error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as 'shopify' | 'woocommerce' | '');
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Providers</option>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'received' | 'processing' | 'processed' | 'failed' | '');
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="received">Received</option>
          <option value="processing">Processing</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Webhooks Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Topic</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Provider</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Attempts</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Received</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading webhooks...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No webhook events found. Events will appear here when Shopify or WooCommerce sends data.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{event.topic}</span>
                    {event.last_error && (
                      <p className="text-red-400 text-xs mt-1 truncate max-w-xs" title={event.last_error}>
                        {event.last_error}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      event.provider === 'shopify'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-purple-900/50 text-purple-300'
                    }`}>
                      {event.provider}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(event.status)}`}>
                      {getStatusIcon(event.status)}
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {event.attempts}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(event.received_at)}
                  </td>
                  <td className="px-4 py-3">
                    {event.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(event.id)}
                        disabled={retrying === event.id}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50"
                      >
                        <RotateCcw size={14} className={retrying === event.id ? 'animate-spin' : ''} />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Showing {events.length} of {total} events
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
