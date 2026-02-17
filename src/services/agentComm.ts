import { randomUUID } from 'crypto';

// --- Message Types ---

export interface TaskRequest {
  type: 'TaskRequest';
  id: string;
  from: string;
  task: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface TaskResult {
  type: 'TaskResult';
  id: string;
  requestId: string;
  from: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: string;
}

export interface StatusUpdate {
  type: 'StatusUpdate';
  id: string;
  from: string;
  status: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface Heartbeat {
  type: 'Heartbeat';
  id: string;
  from: string;
  uptime: number;
  timestamp: string;
}

export type AgentMessage = TaskRequest | TaskResult | StatusUpdate | Heartbeat;

// --- Agent Registry ---

const AGENT_NAME = process.env.AGENT_NAME || 'NarrativeReactor';

function getAgentRegistry(): Record<string, string> {
  const registry: Record<string, string> = {};
  // Parse AGENT_REGISTRY_* env vars: AGENT_REGISTRY_TRENDPILOT=http://localhost:3500
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('AGENT_REGISTRY_') && value) {
      const name = key.replace('AGENT_REGISTRY_', '');
      registry[name] = value;
    }
  }
  return registry;
}

export function getRegisteredAgents(): Record<string, string> {
  return getAgentRegistry();
}

// --- Message log (in-memory) ---

const messageLog: AgentMessage[] = [];
const MESSAGE_LOG_MAX = 200;

export function getMessageLog(): AgentMessage[] {
  return [...messageLog];
}

// --- Send / Receive ---

export async function sendMessage(targetAgent: string, message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>): Promise<{ success: boolean; error?: string }> {
  const registry = getAgentRegistry();
  const url = registry[targetAgent.toUpperCase()];
  if (!url) {
    return { success: false, error: `Unknown agent: ${targetAgent}. Registered: ${Object.keys(registry).join(', ')}` };
  }

  const fullMessage: AgentMessage = {
    ...message,
    id: randomUUID(),
    from: AGENT_NAME,
    timestamp: new Date().toISOString(),
  } as AgentMessage;

  try {
    const resp = await fetch(`${url}/api/agents/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullMessage),
    });
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}: ${await resp.text()}` };
    }
    messageLog.push(fullMessage);
    if (messageLog.length > MESSAGE_LOG_MAX) messageLog.shift();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export type MessageHandler = (message: AgentMessage) => Promise<any>;
const handlers: MessageHandler[] = [];

export function onMessage(handler: MessageHandler): void {
  handlers.push(handler);
}

export async function receiveMessage(message: AgentMessage): Promise<{ acknowledged: boolean; results?: any[] }> {
  // Ensure required fields
  if (!message.type || !message.from) {
    throw new Error('Invalid message: missing type or from');
  }
  message.id = message.id || randomUUID();
  message.timestamp = message.timestamp || new Date().toISOString();

  messageLog.push(message);
  if (messageLog.length > MESSAGE_LOG_MAX) messageLog.shift();

  const results: any[] = [];
  for (const handler of handlers) {
    try {
      results.push(await handler(message));
    } catch (err: any) {
      results.push({ error: err.message });
    }
  }

  return { acknowledged: true, results };
}

// --- Helper constructors ---

export function createTaskRequest(task: string, payload: Record<string, any> = {}): Omit<TaskRequest, 'id' | 'from' | 'timestamp'> {
  return { type: 'TaskRequest', task, payload };
}

export function createTaskResult(requestId: string, success: boolean, result?: any, error?: string): Omit<TaskResult, 'id' | 'from' | 'timestamp'> {
  return { type: 'TaskResult', requestId, success, result, error };
}

export function createStatusUpdate(status: string, details?: Record<string, any>): Omit<StatusUpdate, 'id' | 'from' | 'timestamp'> {
  return { type: 'StatusUpdate', status, details };
}

export function createHeartbeat(uptime: number): Omit<Heartbeat, 'id' | 'from' | 'timestamp'> {
  return { type: 'Heartbeat', uptime };
}
