export interface Automation {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  entry_event: string;
  entry_segment_id?: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  stats: AutomationStats;
  created_at: string;
  updated_at: string;
}

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  position: { x: number; y: number };
  data: AutomationNodeData;
}

export type AutomationNodeType = 'trigger' | 'condition' | 'delay' | 'action';

export type AutomationNodeData =
  | TriggerNodeData
  | ConditionNodeData
  | DelayNodeData
  | ActionNodeData;

export interface TriggerNodeData {
  type: 'trigger';
  event_name: string;
  filters?: SegmentRule[];
}

export interface ConditionNodeData {
  type: 'condition';
  rules: SegmentRule[];
  match: 'all' | 'any';
}

export interface DelayNodeData {
  type: 'delay';
  duration: string; // e.g., "30m", "2h", "1d"
}

export interface ActionNodeData {
  type: 'action';
  action_type: 'send_push' | 'add_tag' | 'remove_tag' | 'webhook';
  config: PushActionConfig | TagActionConfig | WebhookActionConfig;
}

export interface PushActionConfig {
  template_id: string;
  fallback_template_id?: string;
}

export interface TagActionConfig {
  tag_key: string;
  tag_value?: string;
}

export interface WebhookActionConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface AutomationEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition_key?: 'true' | 'false';
}

export interface AutomationStats {
  total_entered: number;
  total_completed: number;
  total_exited: number;
  pushes_sent: number;
  pushes_opened: number;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  device_id: string;
  store_id: string;
  status: AutomationRunStatus;
  current_node_id?: string;
  started_at: string;
  completed_at?: string;
  exited_at?: string;
  exit_reason?: string;
}

export type AutomationRunStatus = 'running' | 'waiting' | 'completed' | 'exited';

export interface CreateAutomationRequest {
  name: string;
  description?: string;
  entry_event: string;
  entry_segment_id?: string;
  nodes: Omit<AutomationNode, 'id'>[];
  edges: Omit<AutomationEdge, 'id'>[];
}

export interface UpdateAutomationRequest {
  name?: string;
  description?: string;
  status?: AutomationStatus;
  nodes?: AutomationNode[];
  edges?: AutomationEdge[];
}
