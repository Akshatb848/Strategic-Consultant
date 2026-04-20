import { Server, Socket } from 'socket.io';
import { Response } from 'express';
import jwt from 'jsonwebtoken';

let io: Server;

// SSE subscribers: analysisId → Set of Response objects
const sseClients = new Map<string, Set<Response>>();

export function registerSseClient(analysisId: string, res: Response): () => void {
  if (!sseClients.has(analysisId)) sseClients.set(analysisId, new Set());
  sseClients.get(analysisId)!.add(res);
  return () => {
    sseClients.get(analysisId)?.delete(res);
    if (sseClients.get(analysisId)?.size === 0) sseClients.delete(analysisId);
  };
}

function broadcastSse(analysisId: string, event: string, data: unknown): void {
  const clients = sseClients.get(analysisId);
  if (!clients?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

export function initSocketIO(httpServer: any): void {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-secret') as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('subscribe:analysis', (analysisId: string) => {
      socket.join(`analysis:${analysisId}`);
    });
    socket.on('unsubscribe:analysis', (analysisId: string) => {
      socket.leave(`analysis:${analysisId}`);
    });
  });
}

export function emitPipelineEvent(analysisId: string, event: {
  agent: string;
  status?: string;
  message?: string;
  confidence?: number;
  selfCorrection?: boolean;
}): void {
  const payload = { ...event, timestamp: new Date().toISOString() };
  if (io) io.to(`analysis:${analysisId}`).emit('pipeline:update', payload);
  // SSE broadcast — map to frontend event names
  const eventName = event.status === 'running' ? 'agent_start' : event.status === 'completed' ? 'agent_complete' : event.status === 'failed' ? 'analysis_failed' : 'agent_start';
  broadcastSse(analysisId, eventName, { agent: event.agent, ...payload });
}

export function emitAnalysisComplete(analysisId: string, summary: {
  overallConfidence: number;
  decisionRecommendation: string;
  durationSeconds: number;
}): void {
  if (io) io.to(`analysis:${analysisId}`).emit('pipeline:complete', summary);
  broadcastSse(analysisId, 'analysis_complete', summary);
  broadcastSse(analysisId, 'decision_reached', { decision: summary.decisionRecommendation, confidence: summary.overallConfidence });
}
