const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3401';

async function apiFetch(path: string, options: RequestInit = {}) {
  const apiKey = import.meta.env.VITE_API_KEY || '';
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Content Pipeline
export const generateContent = (topic: string, context?: string, useClaude?: boolean) =>
  apiFetch('/api/pipeline/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, context, useClaude }),
  });

export const researchTopic = (topic: string, context?: string) =>
  apiFetch('/api/pipeline/research', {
    method: 'POST',
    body: JSON.stringify({ topic, context }),
  });

export const listDrafts = (status?: string) =>
  apiFetch(`/api/pipeline/drafts${status ? `?status=${status}` : ''}`);

export const getDraft = (id: string) =>
  apiFetch(`/api/pipeline/drafts/${id}`);

export const approveDraft = (id: string) =>
  apiFetch(`/api/pipeline/drafts/${id}/approve`, { method: 'POST' });

export const rejectDraft = (id: string, feedback: string) =>
  apiFetch(`/api/pipeline/drafts/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });

export const updateDraftContent = (id: string, format: string, content: string) =>
  apiFetch(`/api/pipeline/drafts/${id}/content`, {
    method: 'PUT',
    body: JSON.stringify({ format, content }),
  });

// Blotato Publishing
export const publishDraft = (draftId: string, platforms: string[], format: string, scheduledAt?: string) =>
  apiFetch('/api/pipeline/publish', {
    method: 'POST',
    body: JSON.stringify({ draftId, platforms, format, scheduledAt }),
  });

export const publishDirect = (content: string, platforms: string[]) =>
  apiFetch('/api/pipeline/publish/direct', {
    method: 'POST',
    body: JSON.stringify({ content, platforms }),
  });

export const getQueue = () => apiFetch('/api/pipeline/queue');

export const getQueueItem = (id: string) => apiFetch(`/api/pipeline/queue/${id}`);

export const cancelQueueItem = (id: string) =>
  apiFetch(`/api/pipeline/queue/${id}`, { method: 'DELETE' });

export const listAccounts = () => apiFetch('/api/pipeline/accounts');

// Costs
export const getCosts = () => apiFetch('/api/costs');
