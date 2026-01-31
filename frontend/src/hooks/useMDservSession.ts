import { useState, useEffect, useCallback } from 'react';
import { MDservClient } from '@/services/mdserv';
import { apiClient } from '@/services/api';
import type { CreateSessionResponse } from '@/types/visualization';

interface UseMDservSessionOptions {
  runId: number;
  autoConnect?: boolean;
}

export function useMDservSession({ runId, autoConnect = true }: UseMDservSessionOptions) {
  const [session, setSession] = useState<CreateSessionResponse | null>(null);
  const [client, setClient] = useState<MDservClient | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const createSession = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      const sessionData = await apiClient.createVisualizationSession(runId);
      setSession(sessionData);

      const mdservClient = new MDservClient({
        url: sessionData.mdserv_url,
        sessionId: sessionData.session_id,
      });

      mdservClient.onStatus((connectionStatus) => {
        if (connectionStatus === 'connected') {
          setStatus('connected');
        } else if (connectionStatus === 'disconnected') {
          setStatus('disconnected');
        } else {
          setStatus('error');
        }
      });

      await mdservClient.connect();
      setClient(mdservClient);

      return sessionData;
    } catch (err) {
      setError(err as Error);
      setStatus('error');
      throw err;
    }
  }, [runId]);

  const terminateSession = useCallback(async () => {
    if (client) {
      client.disconnect();
      setClient(null);
    }

    if (session) {
      try {
        await apiClient.terminateVisualizationSession(session.session_id);
      } catch (err) {
        console.error('Failed to terminate session:', err);
      }
      setSession(null);
    }

    setStatus('idle');
  }, [client, session]);

  const reconnect = useCallback(async () => {
    if (client) {
      try {
        setStatus('connecting');
        await client.connect();
      } catch (err) {
        setError(err as Error);
        setStatus('error');
      }
    } else {
      await createSession();
    }
  }, [client, createSession]);

  // Calculate time remaining until session expires
  useEffect(() => {
    if (!session) return;

    const updateTimeRemaining = () => {
      const expiresAt = new Date(session.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setStatus('disconnected');
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && status === 'idle') {
      createSession();
    }

    return () => {
      if (client) {
        client.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    session,
    client,
    status,
    error,
    timeRemaining,
    createSession,
    terminateSession,
    reconnect,
  };
}
