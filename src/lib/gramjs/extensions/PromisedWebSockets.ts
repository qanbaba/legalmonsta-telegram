import { Mutex } from 'async-mutex';

import { concat } from '../../../util/encoding/buffer';

const closeError = new Error('WebSocket was closed');
const CONNECTION_TIMEOUT = 3000;
const MAX_TIMEOUT = 30000;

export default class PromisedWebSockets {
  private readonly mutex = new Mutex();

  private closed: boolean;

  private timeout: number;

  private stream: Uint8Array;

  private canRead?: boolean | Promise<boolean>;

  private resolveRead: ((value?: any) => void) | undefined;

  private client: WebSocket | undefined;

  private website?: string;

  private disconnectedCallback: () => void;

  constructor(disconnectedCallback: () => void) {
    this.client = undefined;
    this.closed = true;
    this.stream = new Uint8Array(0);
    this.disconnectedCallback = disconnectedCallback;
    this.timeout = CONNECTION_TIMEOUT;
  }

  async readExactly(number: number) {
    let readData = new Uint8Array(0);

    while (true) {
      const thisTime = await this.read(number);
      readData = concat(readData, thisTime);
      number -= thisTime.length;
      if (!number) {
        return readData;
      }
    }
  }

  async read(number: number) {
    if (this.closed) {
      throw closeError;
    }
    await this.canRead;
    if (this.closed) {
      throw closeError;
    }
    const toReturn = this.stream.slice(0, number);
    this.stream = this.stream.slice(number);
    if (this.stream.length === 0) {
      this.canRead = new Promise((resolve) => {
        this.resolveRead = resolve;
      });
    }

    return toReturn;
  }

  async readAll() {
    if (this.closed || !await this.canRead) {
      throw closeError;
    }
    const toReturn = this.stream;
    this.stream = new Uint8Array(0);
    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });

    return toReturn;
  }

  getWebSocketLink(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    if (port === 443) {
      return `wss://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    } else {
      return `ws://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    }
  }

  connect(port: number, ip: string, isTestServer = false, isPremium = false) {
    this.stream = new Uint8Array(0);
    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });
    this.closed = false;
    this.website = this.getWebSocketLink(ip, port, isTestServer, isPremium);
    const client = new WebSocket(this.website, 'binary');
    this.client = client;
    client.binaryType = 'arraybuffer';

    return new Promise((resolve, reject) => {
      let hasSettled = false;
      let hasDisconnected = false;

      const handleOffline = () => {
        rejectConnection(new Error('WebSocket went offline'));
        finishDisconnect();
        client.close();
      };

      const finishDisconnect = () => {
        if (hasDisconnected) return;
        hasDisconnected = true;
        if (timeout) clearTimeout(timeout);
        self.removeEventListener('offline', handleOffline);
        if (client !== this.client) return;
        this.resolveRead?.(false);
        this.closed = true;
        this.disconnectedCallback();
      };

      const rejectConnection = (error: Error) => {
        if (hasSettled) return;
        hasSettled = true;
        if (timeout) clearTimeout(timeout);
        reject(error);
      };

      client.onopen = () => {
        if (hasSettled || client !== this.client) {
          client.close();
          return;
        }
        hasSettled = true;
        if (timeout) clearTimeout(timeout);
        this.receive();
        resolve(this);
      };

      client.onerror = () => {
        // Browser events and close reasons are not safe diagnostic payloads
        // eslint-disable-next-line no-console
        console.error('WebSocket connection error');
        rejectConnection(new Error('WebSocket connection error'));
        finishDisconnect();
        client.close();
      };

      client.onclose = ({ code, wasClean }) => {
        rejectConnection(new Error(`WebSocket closed before connecting. Code: ${code}`));
        if (code !== 1000) {
          // eslint-disable-next-line no-console
          console.error('WebSocket closed', { code, wasClean });
        }
        finishDisconnect();
      };

      const timeout = setTimeout(() => {
        if (hasSettled) return;
        rejectConnection(new Error('WebSocket connection timeout'));
        finishDisconnect();
        client.close();
        this.timeout = Math.min(this.timeout * 2, MAX_TIMEOUT);
      }, this.timeout);

      self.addEventListener('offline', handleOffline);
    });
  }

  write(data: Uint8Array) {
    if (this.closed) {
      throw closeError;
    }
    this.client?.send(new Uint8Array(data));
  }

  close() {
    this.client?.close();
    this.closed = true;
  }

  receive() {
    if (!this.client) return;
    this.client.onmessage = async (message) => {
      await this.mutex.runExclusive(async () => {
        const data = message.data instanceof ArrayBuffer
          ? new Uint8Array(message.data)
          : new Uint8Array(await new Response(message.data).arrayBuffer());
        this.stream = concat(this.stream, data);
        this.resolveRead?.(true);
      });
    };
  }
}
