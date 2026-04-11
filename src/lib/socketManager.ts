import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io: Server | null = null;

// ── Initialise Socket.IO ─────────────────────────────────────────────────────
export function initSocketIO(httpServer: any): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    // Subscribe to analysis updates
    socket.on('subscribe:analysis', (analysisId: string) => {
      socket.join(`analysis:${analysisId}`);
      logger.debug({ userId, analysisId }, 'Subscribed to analysis');
    });

    socket.on('unsubscribe:analysis', (analysisId: string) => {
      socket.leave(`analysis:${analysisId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  logger.info('✅ Socket.IO initialised');
  return io;
}

// ── Emit pipeline events ─────────────────────────────────────────────────────
export function emitPipelineEvent(
  analysisId: string,
  event: {
    agent: string;
    status?: string;
    message?: string;
    confidence?: number;
    selfCorrection?: boolean;
    data?: Record<string, unknown>;
  }
): void {
  if (!io) return;
  io.to(`analysis:${analysisId}`).emit('pipeline:update', {
    ...event,
    timestamp: new Date().toISOString(),
  });
}

export function emitAnalysisComplete(
  analysisId: string,
  summary: {
    overallConfidence: number;
    decisionRecommendation: string;
    durationSeconds: number;
  }
): void {
  if (!io) return;
  io.to(`analysis:${analysisId}`).emit('pipeline:complete', {
    ...summary,
    timestamp: new Date().toISOString(),
  });
}

export function getIO(): Server | null {
  return io;
}
