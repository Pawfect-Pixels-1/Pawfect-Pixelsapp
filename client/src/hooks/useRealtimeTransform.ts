import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealtimeUpdate {
  type: 'progress' | 'status' | 'preview' | 'completed' | 'error';
  operationId: string;
  data: any;
  timestamp: number;
}

export interface TransformationProgress {
  operationId: string;
  status: 'starting' | 'processing' | 'completed' | 'failed' | 'idle';
  progress: number;
  message?: string;
  previewUrl?: string;
  results?: string[];
  error?: string;
  startTime?: number;
}

export function useRealtimeTransform() {
  const [isConnected, setIsConnected] = useState(false);
  const [transformations, setTransformations] = useState<Map<string, TransformationProgress>>(new Map());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      // Clear any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;
      
      console.log('🔌 Connecting to real-time service:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Real-time WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        
        // Send ping to verify connection
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          console.log('📡 Real-time update:', update);
          
          setTransformations(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(update.operationId) || {
              operationId: update.operationId,
              status: 'idle',
              progress: 0,
            };

            let updated: TransformationProgress = { ...existing };

            switch (update.type) {
              case 'status':
                if (update.data.status) {
                  updated.status = update.data.status;
                }
                if (update.data.message) {
                  updated.message = update.data.message;
                }
                if (update.data.input) {
                  updated.startTime = Date.now();
                }
                break;
                
              case 'progress':
                updated.progress = update.data.progress || 0;
                updated.status = 'processing';
                if (update.data.message) {
                  updated.message = update.data.message;
                }
                break;
                
              case 'preview':
                updated.previewUrl = update.data.previewUrl;
                if (update.data.progress !== undefined) {
                  updated.progress = update.data.progress;
                }
                break;
                
              case 'completed':
                updated.status = 'completed';
                updated.progress = 100;
                updated.results = update.data.results;
                updated.message = 'Transformation completed successfully!';
                break;
                
              case 'error':
                updated.status = 'failed';
                updated.error = update.data.error;
                updated.message = update.data.error;
                break;
            }

            newMap.set(update.operationId, updated);
            return newMap;
          });
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect if not a normal close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Failed to connect to real-time service. Please refresh the page.');
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionError('Real-time connection error. Retrying...');
      };
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionError('Failed to connect to real-time service');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  const subscribeToOperation = useCallback((operationId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        operationId
      }));
      console.log('📡 Subscribed to operation:', operationId);
    }
  }, []);

  const startTransformation = useCallback(async (formData: FormData) => {
    try {
      const response = await fetch('/api/transform-realtime', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.operationId) {
        // Subscribe to updates for this operation
        subscribeToOperation(result.operationId);
        
        // Initialize transformation state
        setTransformations(prev => {
          const newMap = new Map(prev);
          newMap.set(result.operationId, {
            operationId: result.operationId,
            status: 'starting',
            progress: 0,
            message: 'Starting transformation...',
            startTime: Date.now(),
          });
          return newMap;
        });

        return { success: true, operationId: result.operationId };
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('❌ Failed to start transformation:', error);
      throw error;
    }
  }, [subscribeToOperation]);

  const getTransformation = useCallback((operationId: string): TransformationProgress | undefined => {
    return transformations.get(operationId);
  }, [transformations]);

  const clearTransformation = useCallback((operationId: string) => {
    setTransformations(prev => {
      const newMap = new Map(prev);
      newMap.delete(operationId);
      return newMap;
    });
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionError,
    transformations: Array.from(transformations.values()),
    connect,
    disconnect,
    subscribeToOperation,
    startTransformation,
    getTransformation,
    clearTransformation,
  };
}