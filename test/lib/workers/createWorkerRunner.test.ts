/**
 * createWorkerRunner and exposeCalculation. jsdom has no Worker, so a fake
 * one is stubbed in: it hands each posted request to a worker-side scope
 * wired with exposeCalculation, delivering on demand so tests control the
 * order.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkerRunner } from '@/lib/workers/createWorkerRunner';
import {
  exposeCalculation,
  type CalculationRequest,
  type CalculationResponse,
  type CalculationScope,
} from '@/lib/workers/exposeCalculation';

interface Inputs {
  n: number;
}

/** The worker-side calculation: doubles n, and throws for a negative n. */
function double({ n }: Inputs): number {
  if (n < 0) throw new Error('n must not be negative.');
  return n * 2;
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<CalculationResponse<number>>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  failPost = false;
  readonly inbox: CalculationRequest<Inputs>[] = [];
  private readonly scope: CalculationScope<Inputs, number>;

  constructor() {
    FakeWorker.instances.push(this);
    this.scope = {
      onmessage: null,
      postMessage: (message) => this.onmessage?.({ data: message } as MessageEvent<CalculationResponse<number>>),
    };
    exposeCalculation(double, this.scope);
  }

  postMessage(request: CalculationRequest<Inputs>): void {
    if (this.failPost) throw new DOMException('could not be cloned', 'DataCloneError');
    this.inbox.push(request);
  }

  /** Answers the oldest request (or the one at `index`). */
  deliver(index = 0): void {
    const [request] = this.inbox.splice(index, 1);
    this.scope.onmessage?.({ data: request } as MessageEvent<CalculationRequest<Inputs>>);
  }

  /** Simulates the worker script failing. */
  crash(): void {
    this.onerror?.(new Event('error'));
  }

  terminate(): void {
    this.terminated = true;
  }
}

function stubWorker(): void {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
}

function runnerWith(create: () => Worker = () => new Worker('fake')) {
  const fallback = vi.fn(double);
  const run = createWorkerRunner<Inputs, number>({ create, fallback });
  return { run, fallback };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('without Worker', () => {
  it('runs the fallback in-thread and wraps the result in a promise', async () => {
    const create = vi.fn(() => new Worker('never'));
    const { run, fallback } = runnerWith(create);
    await expect(run({ n: 4 })).resolves.toBe(8);
    expect(fallback).toHaveBeenCalledWith({ n: 4 });
    expect(create).not.toHaveBeenCalled();
  });

  it('turns a throwing fallback into a rejection', async () => {
    const { run } = runnerWith();
    await expect(run({ n: -1 })).rejects.toThrow('n must not be negative.');
  });

  it('prewarm is a no-op', () => {
    const create = vi.fn(() => new Worker('never'));
    const { run } = runnerWith(create);
    expect(() => run.prewarm()).not.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('with a worker', () => {
  it('runs off-thread and matches answers to requests by id', async () => {
    stubWorker();
    const { run, fallback } = runnerWith();
    const first = run({ n: 1 });
    const second = run({ n: 2 });
    const worker = FakeWorker.instances[0];
    expect(worker.inbox.map((request) => request.id)).toEqual([1, 2]);
    worker.deliver(1);
    worker.deliver(0);
    await expect(first).resolves.toBe(2);
    await expect(second).resolves.toBe(4);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('rejects with the message the worker reports', async () => {
    stubWorker();
    const { run } = runnerWith();
    const result = run({ n: -3 });
    FakeWorker.instances[0].deliver();
    await expect(result).rejects.toThrow('n must not be negative.');
  });

  it('prewarm creates one worker, and only one, before the first run', async () => {
    stubWorker();
    const { run } = runnerWith();
    run.prewarm();
    run.prewarm();
    expect(FakeWorker.instances).toHaveLength(1);
    const result = run({ n: 5 });
    expect(FakeWorker.instances).toHaveLength(1);
    FakeWorker.instances[0].deliver();
    await expect(result).resolves.toBe(10);
  });

  it('retires a broken worker and retries what it owed in-thread', async () => {
    stubWorker();
    const { run, fallback } = runnerWith();
    const first = run({ n: 1 });
    const second = run({ n: 2 });
    const worker = FakeWorker.instances[0];
    worker.crash();
    await expect(first).resolves.toBe(2);
    await expect(second).resolves.toBe(4);
    expect(worker.terminated).toBe(true);
    expect(fallback).toHaveBeenCalledTimes(2);
    // From now on every run stays in-thread; no second worker is made.
    await expect(run({ n: 3 })).resolves.toBe(6);
    run.prewarm();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('runs in-thread when posting fails, and stops using the worker', async () => {
    stubWorker();
    const { run, fallback } = runnerWith();
    run.prewarm();
    FakeWorker.instances[0].failPost = true;
    await expect(run({ n: 6 })).resolves.toBe(12);
    await expect(run({ n: 7 })).resolves.toBe(14);
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it('falls back for good when construction throws', async () => {
    stubWorker();
    const create = vi.fn((): Worker => {
      throw new Error('unsupported');
    });
    const { run, fallback } = runnerWith(create);
    await expect(run({ n: 1 })).resolves.toBe(2);
    await expect(run({ n: 2 })).resolves.toBe(4);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer to a request it no longer waits for', async () => {
    stubWorker();
    const { run } = runnerWith();
    const result = run({ n: 1 });
    const worker = FakeWorker.instances[0];
    worker.onmessage?.({ data: { id: 99, ok: true, results: 0 } } as MessageEvent<CalculationResponse<number>>);
    worker.deliver();
    await expect(result).resolves.toBe(2);
  });

  it('dispose terminates the worker, finishes its runs in-thread and lets the next run start fresh', async () => {
    stubWorker();
    const { run, fallback } = runnerWith();
    const owed = run({ n: 2 });
    run.dispose();
    await expect(owed).resolves.toBe(4);
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(fallback).toHaveBeenCalledTimes(1);
    run.prewarm();
    expect(FakeWorker.instances).toHaveLength(2);
  });
});

describe('exposeCalculation', () => {
  it('answers each request with its id and the result or the error message', () => {
    const posted: CalculationResponse<number>[] = [];
    const scope: CalculationScope<Inputs, number> = { onmessage: null, postMessage: (m) => posted.push(m) };
    exposeCalculation(double, scope);
    scope.onmessage?.({ data: { id: 7, inputs: { n: 21 } } } as MessageEvent<CalculationRequest<Inputs>>);
    scope.onmessage?.({ data: { id: 8, inputs: { n: -1 } } } as MessageEvent<CalculationRequest<Inputs>>);
    const throwsString = (): number => {
      throw 'plain string';
    };
    exposeCalculation(throwsString, scope);
    scope.onmessage?.({ data: { id: 9, inputs: { n: 0 } } } as MessageEvent<CalculationRequest<Inputs>>);
    expect(posted).toEqual([
      { id: 7, ok: true, results: 42 },
      { id: 8, ok: false, message: 'n must not be negative.' },
      { id: 9, ok: false, message: 'Calculation failed' },
    ]);
  });
});
