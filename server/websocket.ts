import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import session from 'express-session';
import { IncomingMessage } from 'http';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  sessionId?: string;
}

export interface RealtimeUpdate {
  type: 'progress' | 'status' | 'preview' | 'completed' | 'error';
  operationId: string;
  data: any;
  timestamp: number;
}

class RealtimeService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private operations: Map<string, any> = new Map();

  constructor(server: Server, sessionParser: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/api/realtime',
      verifyClient: (info: any) => {
        // Basic verification - will authenticate on connection
        return true;
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request, sessionParser);
    });

    console.log('🔄 Real-time WebSocket service initialized');
  }

  private handleConnection(ws: AuthenticatedWebSocket, request: IncomingMessage, sessionParser: any) {
    // Create a mock response object for session parsing
    const mockResponse = {
      setHeader: () => {},
      getHeader: () => {},
      writeHead: () => {},
      end: () => {}
    };

    // Parse session from the request
    sessionParser(request, mockResponse, () => {
      const session = (request as any).session;
      
      if (!session?.user) {
        console.log('❌ WebSocket connection rejected: not authenticated', { 
          hasSession: !!session, 
          sessionKeys: session ? Object.keys(session) : 'none',
          cookies: request.headers.cookie || 'none'
        });
        ws.close(1008, 'Authentication required');
        return;
      }

      // Store user info in WebSocket connection
      ws.userId = session.user.id;
      ws.username = session.user.username;
      ws.sessionId = session.id;

      console.log(`🔌 WebSocket connected: ${ws.username} (${ws.userId})`);

      // Add to clients map
      if (ws.userId) {
        const userClients = this.clients.get(ws.userId.toString()) || new Set();
        userClients.add(ws);
        this.clients.set(ws.userId.toString(), userClients);
      }

      // Send welcome message
      this.sendToClient(ws, {
        type: 'status',
        operationId: 'connection',
        data: { 
          message: 'Connected to real-time preview service',
          userId: ws.userId,
          username: ws.username
        },
        timestamp: Date.now()
      });

      // Handle messages from client
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ Invalid WebSocket message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${ws.username}:`, error);
        this.handleDisconnect(ws);
      });
    });
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: any) {
    switch (message.type) {
      case 'subscribe':
        // Subscribe to updates for a specific operation
        if (message.operationId && ws.userId) {
          console.log(`📡 User ${ws.username} subscribed to operation ${message.operationId}`);
          
          // Send current status if operation exists
          const operation = this.operations.get(message.operationId);
          if (operation) {
            this.sendToClient(ws, {
              type: 'status',
              operationId: message.operationId,
              data: operation,
              timestamp: Date.now()
            });
          }
        }
        break;
      
      case 'ping':
        // Respond with pong for connection health check
        this.sendToClient(ws, {
          type: 'status',
          operationId: 'ping',
          data: { message: 'pong' },
          timestamp: Date.now()
        });
        break;
        
      default:
        console.log(`❓ Unknown WebSocket message type: ${message.type}`);
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId.toString());
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId.toString());
        }
      }
      console.log(`🔌 WebSocket disconnected: ${ws.username} (${ws.userId})`);
    }
  }

  private sendToClient(ws: AuthenticatedWebSocket, update: RealtimeUpdate) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(update));
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
      }
    }
  }

  private sendToUser(userId: number, update: RealtimeUpdate) {
    const userClients = this.clients.get(userId.toString());
    if (userClients) {
      userClients.forEach(ws => {
        this.sendToClient(ws, update);
      });
    }
  }

  private broadcast(update: RealtimeUpdate) {
    this.clients.forEach(userClients => {
      userClients.forEach(ws => {
        this.sendToClient(ws, update);
      });
    });
  }

  // Public methods for sending updates

  public updateProgress(operationId: string, userId: number, progress: number, message?: string) {
    const update: RealtimeUpdate = {
      type: 'progress',
      operationId,
      data: { progress, message },
      timestamp: Date.now()
    };

    // Update stored operation
    const operation = this.operations.get(operationId) || {};
    operation.progress = progress;
    operation.status = 'processing';
    if (message) operation.message = message;
    this.operations.set(operationId, operation);

    this.sendToUser(userId, update);
    console.log(`📊 Progress update: ${operationId} -> ${progress}% ${message || ''}`);
  }

  public updateStatus(operationId: string, userId: number, status: string, data?: any) {
    const update: RealtimeUpdate = {
      type: 'status',
      operationId,
      data: { status, ...data },
      timestamp: Date.now()
    };

    // Update stored operation
    const operation = this.operations.get(operationId) || {};
    operation.status = status;
    if (data) Object.assign(operation, data);
    this.operations.set(operationId, operation);

    this.sendToUser(userId, update);
    console.log(`📡 Status update: ${operationId} -> ${status}`);
  }

  public sendPreview(operationId: string, userId: number, previewUrl: string, progress?: number) {
    const update: RealtimeUpdate = {
      type: 'preview',
      operationId,
      data: { previewUrl, progress },
      timestamp: Date.now()
    };

    this.sendToUser(userId, update);
    console.log(`🖼️ Preview update: ${operationId} -> ${previewUrl}`);
  }

  public sendCompleted(operationId: string, userId: number, results: string[]) {
    const update: RealtimeUpdate = {
      type: 'completed',
      operationId,
      data: { results },
      timestamp: Date.now()
    };

    // Update stored operation
    const operation = this.operations.get(operationId) || {};
    operation.status = 'completed';
    operation.results = results;
    operation.progress = 100;
    this.operations.set(operationId, operation);

    this.sendToUser(userId, update);
    console.log(`✅ Completed: ${operationId} -> ${results.length} results`);
  }

  public sendError(operationId: string, userId: number, error: string) {
    const update: RealtimeUpdate = {
      type: 'error',
      operationId,
      data: { error },
      timestamp: Date.now()
    };

    // Update stored operation
    const operation = this.operations.get(operationId) || {};
    operation.status = 'failed';
    operation.error = error;
    this.operations.set(operationId, operation);

    this.sendToUser(userId, update);
    console.log(`❌ Error: ${operationId} -> ${error}`);
  }

  public getOperation(operationId: string) {
    return this.operations.get(operationId);
  }

  public setOperation(operationId: string, operation: any) {
    this.operations.set(operationId, operation);
  }

  public getConnectedUsers(): number {
    return this.clients.size;
  }

  public getActiveOperations(): number {
    return this.operations.size;
  }
}

export default RealtimeService;