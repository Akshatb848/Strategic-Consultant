import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────────────
export interface PipelineEvent {
  agent: string;
  status?: string;
  message?: string;
  confidence?: number;
  selfCorrection?: boolean;
  timestamp: string;
}

export interface PipelineComplete {
  overallConfidence: number;
  decisionRecommendation: string;
  durationSeconds: number;
  timestamp: string;
}

// ── Socket client ────────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToAnalysis(
  analysisId: string,
  onUpdate: (event: PipelineEvent) => void,
  onComplete: (summary: PipelineComplete) => void
): () => void {
  const s = getSocket();
  if (!s.connected) connectSocket();

  s.emit('subscribe:analysis', analysisId);

  s.on('pipeline:update', onUpdate);
  s.on('pipeline:complete', onComplete);

  return () => {
    s.emit('unsubscribe:analysis', analysisId);
    s.off('pipeline:update', onUpdate);
    s.off('pipeline:complete', onComplete);
  };
}
