import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PromisedWebSockets from './PromisedWebSockets';

const PRIVATE_TEXT = 'CANARY-private-token-chat-message';
const CONNECTION_TIMEOUT = 3000;

class TestSocket {
  static instances: TestSocket[] = [];

  binaryType = '';

  onopen?: () => void;

  onerror?: (event: unknown) => void;

  onclose?: (event: { code: number; reason: string; wasClean: boolean }) => void;

  close = vi.fn();

  constructor() {
    TestSocket.instances.push(this);
  }
}

describe('WebSocket connection lifecycle', () => {
  let logs: unknown[][];

  beforeEach(() => {
    vi.useFakeTimers();
    TestSocket.instances = [];
    vi.stubGlobal('WebSocket', TestSocket);
    vi.stubGlobal('self', new EventTarget());
    logs = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      logs.push(args);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects a close before open immediately and omits the server reason', async () => {
    const onDisconnect = vi.fn();
    const transport = new PromisedWebSockets(onDisconnect);
    const pending = transport.connect(443, 'example.invalid');
    const rejection = expect(pending).rejects.toThrow('WebSocket closed before connecting. Code: 1006');
    TestSocket.instances[0].onclose!({ code: 1006, reason: PRIVATE_TEXT, wasClean: false });
    await rejection;
    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs)).not.toContain(PRIVATE_TEXT);
  });

  it('settles a timeout once and ignores a late open or close', async () => {
    const onDisconnect = vi.fn();
    const transport = new PromisedWebSockets(onDisconnect);
    const pending = transport.connect(443, 'example.invalid');
    const rejection = expect(pending).rejects.toThrow('WebSocket connection timeout');
    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT);
    await rejection;
    TestSocket.instances[0].onopen!();
    TestSocket.instances[0].onclose!({ code: 1006, reason: PRIVATE_TEXT, wasClean: false });
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    await expect(transport.readAll()).rejects.toThrow('WebSocket was closed');
  });

  it('does not let events from a failed socket disconnect a replacement', async () => {
    const onDisconnect = vi.fn();
    const transport = new PromisedWebSockets(onDisconnect);
    const first = transport.connect(443, 'example.invalid');
    const rejection = expect(first).rejects.toThrow('WebSocket connection error');
    TestSocket.instances[0].onerror!({ privatePayload: PRIVATE_TEXT });
    await rejection;
    const next = transport.connect(443, 'example.invalid');
    TestSocket.instances[1].onopen!();
    await next;
    TestSocket.instances[0].onclose!({ code: 1006, reason: PRIVATE_TEXT, wasClean: false });
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs)).not.toContain(PRIVATE_TEXT);
    self.dispatchEvent(new Event('offline'));
    expect(onDisconnect).toHaveBeenCalledTimes(2);
    expect(TestSocket.instances[1].close).toHaveBeenCalledTimes(1);
  });
});
