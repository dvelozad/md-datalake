export interface MDservConfig {
  url: string;
  sessionId: string;
}

export interface FrameData {
  frameIndex: number;
  coordinates: Float32Array;
  time: number;
}

export class MDservClient {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private frameCallbacks: Array<(frame: FrameData) => void> = [];
  private statusCallbacks: Array<(status: 'connected' | 'disconnected' | 'error') => void> = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: MDservConfig) {
    this.url = config.url;
    this.sessionId = config.sessionId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.url.replace('http://', 'ws://').replace('https://', 'wss://');
        this.ws = new WebSocket(`${wsUrl}/session/${this.sessionId}`);

        this.ws.onopen = () => {
          console.log('[MDservClient] Connected to MDsrv');
          this.reconnectAttempts = 0;
          this.notifyStatus('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[MDservClient] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[MDservClient] WebSocket error:', error);
          this.notifyStatus('error');
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[MDservClient] Disconnected from MDsrv');
          this.notifyStatus('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MDservClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[MDservClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[MDservClient] Reconnect failed:', error);
      });
    }, delay);
  }

  private handleMessage(data: any): void {
    if (data.type === 'frame') {
      const frameData: FrameData = {
        frameIndex: data.frameIndex,
        coordinates: new Float32Array(data.coordinates),
        time: data.time,
      };
      this.notifyFrame(frameData);
    }
  }

  requestFrame(frameIndex: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'request_frame',
          frameIndex,
        })
      );
    }
  }

  onFrame(callback: (frame: FrameData) => void): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      this.frameCallbacks = this.frameCallbacks.filter((cb) => cb !== callback);
    };
  }

  onStatus(callback: (status: 'connected' | 'disconnected' | 'error') => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyFrame(frame: FrameData): void {
    this.frameCallbacks.forEach((cb) => cb(frame));
  }

  private notifyStatus(status: 'connected' | 'disconnected' | 'error'): void {
    this.statusCallbacks.forEach((cb) => cb(status));
  }

  getStatus(): 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'disconnected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }
}
