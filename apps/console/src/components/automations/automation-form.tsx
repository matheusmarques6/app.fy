'use client';

import { useState } from 'react';
import { X, Zap, Clock, Bell } from 'lucide-react';
import type { Automation, AutomationNode, AutomationEdge } from '@/lib/api-client';

const TRIGGER_EVENTS = [
  { value: 'app_open', label: 'App Opened' },
  { value: 'first_purchase', label: 'First Purchase' },
  { value: 'add_to_cart', label: 'Added to Cart' },
  { value: 'cart_abandoned', label: 'Cart Abandoned' },
  { value: 'order_completed', label: 'Order Completed' },
  { value: 'app_install', label: 'App Installed' },
  { value: 'custom', label: 'Custom Event' },
];

const DELAY_OPTIONS = [
  { value: '0', label: 'No delay' },
  { value: '5', label: '5 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '360', label: '6 hours' },
  { value: '1440', label: '1 day' },
  { value: '4320', label: '3 days' },
  { value: '10080', label: '7 days' },
];

export interface AutomationFormData {
  name: string;
  description: string;
  entry_event: string;
  delay_minutes: number;
  push_title: string;
  push_body: string;
}

interface AutomationFormProps {
  automation?: Automation;
  onSubmit: (data: AutomationFormData) => Promise<void>;
  onClose: () => void;
}

function parseFromNodes(automation: Automation): Partial<AutomationFormData> {
  const delayNode = automation.nodes.find((n) => n.type === 'delay');
  const pushNode = automation.nodes.find((n) => n.type === 'push');
  return {
    delay_minutes: (delayNode?.data?.delay_minutes as number) ?? 0,
    push_title: (pushNode?.data?.title as string) ?? '',
    push_body: (pushNode?.data?.body as string) ?? '',
  };
}

export function buildNodesAndEdges(data: AutomationFormData): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
  const nodes: AutomationNode[] = [
    { id: 'trigger', type: 'trigger', data: { event: data.entry_event } },
  ];
  const edges: AutomationEdge[] = [];

  let lastNodeId = 'trigger';

  if (data.delay_minutes > 0) {
    nodes.push({ id: 'delay', type: 'delay', data: { delay_minutes: data.delay_minutes } });
    edges.push({ id: 'trigger-delay', source: 'trigger', target: 'delay' });
    lastNodeId = 'delay';
  }

  nodes.push({
    id: 'push',
    type: 'push',
    data: { title: data.push_title, body: data.push_body },
  });
  edges.push({ id: `${lastNodeId}-push`, source: lastNodeId, target: 'push' });

  return { nodes, edges };
}

export function AutomationForm({ automation, onSubmit, onClose }: AutomationFormProps) {
  const isEdit = !!automation;
  const parsed = automation ? parseFromNodes(automation) : {};

  const [form, setForm] = useState<AutomationFormData>({
    name: automation?.name ?? '',
    description: automation?.description ?? '',
    entry_event: automation?.entry_event ?? 'app_open',
    delay_minutes: parsed.delay_minutes ?? 0,
    push_title: parsed.push_title ?? '',
    push_body: parsed.push_body ?? '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.entry_event) e.entry_event = 'Trigger event is required';
    if (!form.push_title.trim()) e.push_title = 'Push title is required';
    if (!form.push_body.trim()) e.push_body = 'Push body is required';
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Automation' : 'New Automation'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name & Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Abandoned Cart Reminder"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Step 1: Trigger */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
              <Zap size={16} />
              <span>1. Trigger Event</span>
            </div>
            <select
              value={form.entry_event}
              onChange={(e) => setForm({ ...form, entry_event: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {TRIGGER_EVENTS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.entry_event && <p className="text-red-400 text-xs mt-1">{errors.entry_event}</p>}
          </div>

          {/* Step 2: Delay */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
              <Clock size={16} />
              <span>2. Delay <span className="text-gray-500 font-normal">(optional)</span></span>
            </div>
            <select
              value={String(form.delay_minutes)}
              onChange={(e) => setForm({ ...form, delay_minutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {DELAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Step 3: Push */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-400">
              <Bell size={16} />
              <span>3. Push Notification</span>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input
                type="text"
                value={form.push_title}
                onChange={(e) => setForm({ ...form, push_title: e.target.value })}
                placeholder="e.g. You left items in your cart!"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              {errors.push_title && <p className="text-red-400 text-xs mt-1">{errors.push_title}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Body *</label>
              <textarea
                value={form.push_body}
                onChange={(e) => setForm({ ...form, push_body: e.target.value })}
                rows={2}
                placeholder="e.g. Complete your purchase and get 10% off."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              {errors.push_body && <p className="text-red-400 text-xs mt-1">{errors.push_body}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
