import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalculationError, createWorkerRunner, type WorkerRequest, type WorkerResponse } from '@/lib/workers/createWorkerRunner';
import { exposeCalculation, respond, type CalculationScope } from '@/lib/workers/exposeCalculation';

/** A fake Worker that runs `double` through exposeCalculation, asynchronously. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  posted: WorkerRequest<number>[] = [];
  autoReply = true;
  private readonly scope: CalculationScope<number, number>;

  constructor(fn: (n: number) => number = (n) => n * 2) {
    this.scope = {
      onmessage: null,
      postMessage: (message: WorkerResponse<number>) => {
        queueMicrotask(() => this.onmessage?.({ data: message } as MessageEvent));
      },
    };
    exposeCalculation(fn, this.scope);
  }

  postMessage(request: WorkerRequest<number>) {
    this.posted.push(request);
    if (this.autoReply) this.reply(request);
  }

  reply(request: WorkerRequest<number>) {
    this.scope.onmessage?.({ data: request } as MessageEvent<WorkerRequest<number>>);
  }

  crash() {
    this.onerror?.(new Event('error'));
  }

  terminate() {
    this.terminated = true;
  }
}

const asWorker = (fake: FakeWorker) => fake as unknown as Worker;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createWorkerRunner without Worker support', () => {
  it('falls back to the in-thread calculation', async () => {
    vi.stubGlobal('Worker', undefined);
    const create = vi.fn(() => asWorker(new FakeWorker()));
    const runner = createWorkerRunner({ create, fallback: (n: number) => n + 1 });
    await expect(runner.run(1)).resolves.toBe(2);
    runner.prewarm();
    expect(create).not.toHaveBeenCalled();
    expect(runner.hasWorker()).toBe(false);
  });

  it('rejects with the fallback error', async () => {
    vi.stubGlobal('Worker', undefined);
    const runner = createWorkerRunner<number, number>({
      create: () => asWorker(new FakeWorker()),
      fallback: () => {
        throw new Error('bad inputs');
      },
    });
    await expect(runner.run(1)).rejects.toThrow('bad inputs');
  });
});

describe('createWorkerRunner with a worker', () => {
  it('creates the worker lazily, once, and matches responses by id', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const fake = new FakeWorker();
    const create = vi.fn(() => asWorker(fake));
    const fallback = vi.fn((n: number) => -n);
    const runner = createWorkerRunner({ create, fallback });
    expect(create).not.toHaveBeenCalled();

    const results = await Promise.all([runner.run(2), runner.run(5)]);
    expect(results).toEqual([4, 10]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
    expect(fake.posted.map((r) => r.id)).toEqual([1, 2]);
  });

  it('ignores responses for unknown ids', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const fake = new FakeWorker();
    fake.autoReply = false;
    const runner = createWorkerRunner({ create: () => asWorker(fake), fallback: (n: number) => n });
    const pending = runner.run(3);
    fake.onmessage?.({ data: { id: 99, ok: true, results: 0 } } as MessageEvent);
    fake.reply(fake.posted[0]);
    await expect(pending).resolves.toBe(6);
  });

  it('rejects with a CalculationError carrying engine field errors', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const fake = new FakeWorker(() => {
      throw Object.assign(new Error('Invalid inputs'), { fieldErrors: { age: 'Too old.', bad: 3 } });
    });
    const runner = createWorkerRunner({ create: () => asWorker(fake), fallback: (n: number) => n });
    const error = await runner.run(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CalculationError);
    expect((error as CalculationError).message).toBe('Invalid inputs');
    expect((error as CalculationError).fieldErrors).toEqual({ age: 'Too old.' });
  });

  it('a broken worker retries its stranded runs in-thread and stays retired', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const fake = new FakeWorker();
    fake.autoReply = false;
    const create = vi.fn(() => asWorker(fake));
    const runner = createWorkerRunner({ create, fallback: (n: number) => n + 100 });

    const pending = runner.run(1);
    fake.crash();
    await expect(pending).resolves.toBe(101);
    expect(fake.terminated).toBe(true);
    expect(runner.hasWorker()).toBe(false);

    await expect(runner.run(2)).resolves.toBe(102);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('falls back when construction throws', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const create = vi.fn((): Worker => {
      throw new Error('unsupported');
    });
    const runner = createWorkerRunner({ create, fallback: (n: number) => n * 3 });
    await expect(runner.run(2)).resolves.toBe(6);
    await expect(runner.run(3)).resolves.toBe(9);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('falls back when dispatch throws', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const fake = new FakeWorker();
    fake.postMessage = () => {
      throw new Error('DataCloneError');
    };
    const runner = createWorkerRunner({ create: () => asWorker(fake), fallback: (n: number) => n * 3 });
    await expect(runner.run(2)).resolves.toBe(6);
  });

  it('terminate finishes pending runs in-thread and the next run creates a new worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const first = new FakeWorker();
    first.autoReply = false;
    const second = new FakeWorker();
    const create = vi.fn().mockReturnValueOnce(asWorker(first)).mockReturnValueOnce(asWorker(second));
    const runner = createWorkerRunner({ create, fallback: (n: number) => n + 1 });

    const pending = runner.run(1);
    runner.terminate();
    await expect(pending).resolves.toBe(2);
    expect(first.terminated).toBe(true);
    await expect(runner.run(4)).resolves.toBe(8);
    expect(create).toHaveBeenCalledTimes(2);
    runner.terminate();
    runner.terminate();
  });
});

describe('createWorkerRunner.prewarm', () => {
  it('creates the worker on requestIdleCallback, once', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const callbacks: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    const create = vi.fn(() => asWorker(new FakeWorker()));
    const runner = createWorkerRunner({ create, fallback: (n: number) => n });

    runner.prewarm();
    runner.prewarm();
    expect(callbacks).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
    callbacks[0]();
    expect(create).toHaveBeenCalledTimes(1);
    expect(runner.hasWorker()).toBe(true);
    runner.prewarm();
    expect(callbacks).toHaveLength(1);
  });

  it('uses a timeout where requestIdleCallback is missing', () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('requestIdleCallback', undefined);
    const create = vi.fn(() => asWorker(new FakeWorker()));
    const runner = createWorkerRunner({ create, fallback: (n: number) => n });
    runner.prewarm();
    expect(create).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('exposeCalculation', () => {
  it('answers with results or a serializable error', () => {
    expect(respond((n: number) => n * 2, { id: 1, inputs: 4 })).toEqual({ id: 1, ok: true, results: 8 });
    expect(
      respond(() => {
        throw 'string failure';
      }, { id: 2, inputs: 0 })
    ).toEqual({ id: 2, ok: false, message: 'Calculation failed' });
    expect(
      respond(() => {
        throw Object.assign(new Error('x'), { fieldErrors: ['not a record'] });
      }, { id: 3, inputs: 0 })
    ).toEqual({ id: 3, ok: false, message: 'x' });
    expect(
      respond(() => {
        throw Object.assign(new Error('y'), { fieldErrors: { a: 1 } });
      }, { id: 4, inputs: 0 })
    ).toEqual({ id: 4, ok: false, message: 'y' });
  });

  it('defaults to the global scope', () => {
    const scope = globalThis as unknown as CalculationScope<number, number>;
    const previous = scope.onmessage;
    const post = vi.spyOn(scope, 'postMessage').mockImplementation(() => undefined);
    exposeCalculation((n: number) => n + 1);
    scope.onmessage?.({ data: { id: 7, inputs: 1 } } as MessageEvent<WorkerRequest<number>>);
    expect(post).toHaveBeenCalledWith({ id: 7, ok: true, results: 2 });
    post.mockRestore();
    scope.onmessage = previous;
  });
});
