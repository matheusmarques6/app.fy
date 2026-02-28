'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { SegmentDefinition, SegmentRule } from '@/lib/api-client';

const RULE_TEMPLATES: { label: string; field: string; ops: { label: string; value: string }[]; valueType: 'select' | 'number' | 'days' }[] = [
  {
    label: 'Platform',
    field: 'device.platform',
    ops: [{ label: 'is', value: '==' }, { label: 'is not', value: '!=' }],
    valueType: 'select',
  },
  {
    label: 'Has purchased',
    field: 'metrics.has_purchased',
    ops: [{ label: 'is', value: '==' }],
    valueType: 'select',
  },
  {
    label: 'Last seen',
    field: 'device.last_seen_at',
    ops: [{ label: 'within last', value: 'within_last' }],
    valueType: 'days',
  },
  {
    label: 'Total spent',
    field: 'metrics.total_spent',
    ops: [
      { label: '>', value: '>' },
      { label: '>=', value: '>=' },
      { label: '<', value: '<' },
      { label: '<=', value: '<=' },
    ],
    valueType: 'number',
  },
];

function getTemplateForField(field: string) {
  return RULE_TEMPLATES.find((t) => t.field === field);
}

function getValueOptions(field: string): { label: string; value: string | boolean }[] {
  if (field === 'device.platform') {
    return [
      { label: 'iOS', value: 'ios' },
      { label: 'Android', value: 'android' },
    ];
  }
  if (field === 'metrics.has_purchased') {
    return [
      { label: 'Yes', value: true as unknown as string },
      { label: 'No', value: false as unknown as string },
    ];
  }
  return [];
}

interface SegmentRuleBuilderProps {
  definition: SegmentDefinition;
  onChange: (definition: SegmentDefinition) => void;
}

export function SegmentRuleBuilder({ definition, onChange }: SegmentRuleBuilderProps) {
  const updateMatch = (match: 'all' | 'any') => {
    onChange({ ...definition, match });
  };

  const addRule = () => {
    const defaultTemplate = RULE_TEMPLATES[0];
    const newRule: SegmentRule = {
      field: defaultTemplate.field,
      op: defaultTemplate.ops[0].value,
      value: 'ios',
    };
    onChange({ ...definition, rules: [...definition.rules, newRule] });
  };

  const updateRule = (index: number, updates: Partial<SegmentRule>) => {
    const rules = [...definition.rules];
    rules[index] = { ...rules[index], ...updates };
    onChange({ ...definition, rules });
  };

  const removeRule = (index: number) => {
    onChange({ ...definition, rules: definition.rules.filter((_, i) => i !== index) });
  };

  const handleFieldChange = (index: number, newField: string) => {
    const template = getTemplateForField(newField);
    if (!template) return;

    let defaultValue: SegmentRule['value'] = '';
    if (template.valueType === 'select') {
      const options = getValueOptions(newField);
      defaultValue = options[0]?.value ?? '';
    } else if (template.valueType === 'days') {
      defaultValue = '7d';
    } else {
      defaultValue = 0;
    }

    updateRule(index, {
      field: newField,
      op: template.ops[0].value,
      value: defaultValue,
    });
  };

  return (
    <div className="space-y-3">
      {/* Match mode */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Match</span>
        <select
          value={definition.match}
          onChange={(e) => updateMatch(e.target.value as 'all' | 'any')}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">ALL rules (AND)</option>
          <option value="any">ANY rule (OR)</option>
        </select>
      </div>

      {/* Rules */}
      {definition.rules.map((rule, index) => {
        const template = getTemplateForField(rule.field);

        return (
          <div key={index} className="flex items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
            {/* Field selector */}
            <select
              value={rule.field}
              onChange={(e) => handleFieldChange(index, e.target.value)}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500 min-w-[130px]"
            >
              {RULE_TEMPLATES.map((t) => (
                <option key={t.field} value={t.field}>{t.label}</option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={rule.op}
              onChange={(e) => updateRule(index, { op: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500 min-w-[90px]"
            >
              {(template?.ops ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Value */}
            {template?.valueType === 'select' ? (
              <select
                value={String(rule.value)}
                onChange={(e) => {
                  const val = e.target.value;
                  updateRule(index, {
                    value: val === 'true' ? true : val === 'false' ? false : val,
                  });
                }}
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {getValueOptions(rule.field).map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                ))}
              </select>
            ) : template?.valueType === 'days' ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  min={1}
                  value={parseInt(String(rule.value)) || 7}
                  onChange={(e) => updateRule(index, { value: `${e.target.value}d` })}
                  className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-400 text-sm">days</span>
              </div>
            ) : (
              <input
                type="number"
                value={Number(rule.value) || 0}
                onChange={(e) => updateRule(index, { value: parseFloat(e.target.value) || 0 })}
                placeholder="Value"
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            )}

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeRule(index)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}

      {/* Add rule */}
      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded transition-colors"
      >
        <Plus size={14} />
        Add rule
      </button>
    </div>
  );
}
