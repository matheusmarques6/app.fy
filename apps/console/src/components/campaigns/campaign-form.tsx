'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Campaign, Segment } from '@/lib/api-client';

export interface CampaignFormData {
  name: string;
  description: string;
  title: string;
  body: string;
  segment_id: string;
  scheduled_for: string;
}

interface CampaignFormProps {
  campaign?: Campaign;
  segments: Segment[];
  onSubmit: (data: CampaignFormData) => Promise<void>;
  onClose: () => void;
}

export function CampaignForm({ campaign, segments, onSubmit, onClose }: CampaignFormProps) {
  const isEdit = !!campaign;
  const isReadOnly = campaign?.status === 'sent';

  const [form, setForm] = useState<CampaignFormData>({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    title: campaign?.template?.title?.en ?? '',
    body: campaign?.template?.body?.en ?? '',
    segment_id: campaign?.segment?.id ?? campaign?.segment_id ?? '',
    scheduled_for: campaign?.scheduled_for
      ? new Date(campaign.scheduled_for).toISOString().slice(0, 16)
      : '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignFormData, string>>>({});

  const validate = () => {
    const e: Partial<Record<keyof CampaignFormData, string>> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.title.trim()) e.title = 'Push title is required';
    if (!form.body.trim()) e.body = 'Push body is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="text-lg font-semibold text-white">
            {isReadOnly ? 'View Campaign' : isEdit ? 'Edit Campaign' : 'New Campaign'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isReadOnly && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm">
              This campaign has been sent and cannot be edited.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isReadOnly}
              placeholder="e.g. Summer Sale 2026"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={isReadOnly}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Push Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={isReadOnly}
              placeholder="e.g. Promoção especial hoje!"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Push Body *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              disabled={isReadOnly}
              rows={3}
              placeholder="e.g. Aproveite 20% de desconto em todos os produtos."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60 resize-none"
            />
            {errors.body && <p className="text-red-400 text-xs mt-1">{errors.body}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Target Segment <span className="text-gray-500">(optional)</span>
            </label>
            <select
              value={form.segment_id}
              onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">All subscribers</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Schedule <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_for}
              onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Campaign'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
