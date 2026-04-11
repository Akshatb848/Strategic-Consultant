import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: Server;

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
  if (!io) return;
  io.to(`analysis:${analysisId}`).emit('pipeline:update', { ...event, timestamp: new Date().toISOString() });
}

export function emitAnalysisComplete(analysisId: string, summary: {
  overallConfidence: number;
  decisionRecommendation: string;
  durationSeconds: number;
}): void {
  if (!io) return;
  io.to(`analysis:${analysisId}`).emit('pipeline:complete', summary);
}
