'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import type { Segment, SegmentDefinition } from '@/lib/api-client';
import { segmentsApi } from '@/lib/api-client';
import { SegmentRuleBuilder } from './segment-rule-builder';

export interface SegmentFormData {
  name: string;
  description: string;
  definition: SegmentDefinition;
}

interface SegmentFormProps {
  segment?: Segment;
  accessToken: string;
  storeId: string;
  onSubmit: (data: SegmentFormData) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_DEFINITION: SegmentDefinition = {
  match: 'all',
  rules: [{ field: 'device.platform', op: '==', value: 'ios' }],
};

export function SegmentForm({ segment, accessToken, storeId, onSubmit, onClose }: SegmentFormProps) {
  const isEdit = !!segment;

  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [definition, setDefinition] = useState<SegmentDefinition>(
    segment?.definition ?? DEFAULT_DEFINITION,
  );

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!definition.rules.length) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await segmentsApi.previewDefinition(accessToken, storeId, definition);
      setPreviewCount(result.estimated_count);
    } catch {
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [accessToken, storeId, definition]);

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!definition.rules.length) e.rules = 'At least one rule is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), definition });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Segment' : 'New Segment'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. iOS high-value customers"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rules</label>
            <SegmentRuleBuilder definition={definition} onChange={setDefinition} />
            {errors.rules && <p className="text-red-400 text-xs mt-1">{errors.rules}</p>}
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
            <Users size={18} className="text-blue-400" />
            <span className="text-sm text-gray-300">Estimated members:</span>
            {previewLoading ? (
              <span className="text-sm text-gray-500">calculating...</span>
            ) : previewCount !== null ? (
              <span className="text-sm text-white font-medium">{previewCount.toLocaleString()}</span>
            ) : (
              <span className="text-sm text-gray-500">-</span>
            )}
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
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Segment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
