import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestRenderer } from '../src/features/projects/render-queue.ts';

test('Streaming renders serialize, coalesce waiting snapshots and finish with the final render', async () => {
  const started: number[] = [];
  const published: number[] = [];
  const releases: Array<() => void> = [];
  const queue = latestRenderer<number, number>(async (n) => {
    started.push(n);
    await new Promise<void>(resolve => releases.push(resolve));
    return n;
  }, (_, n) => published.push(n), () => assert.fail('Unexpected render error'));
  queue.push(1); queue.push(2); queue.push(3);
  assert.deepEqual(started, [1]);
  releases.shift()!(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [1, 3]);
  releases.shift()!(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, [1, 3]);
  queue.dispose();
});

test('Unmount prevents late publication and queued work; invalid partials do not stop the queue', async () => {
  let release!: () => void;
  const published: number[] = [];
  const failures: number[] = [];
  const queue = latestRenderer<number, number>(async n => {
    if (n === 1) throw Error('Incomplete draft');
    await new Promise<void>(resolve => { release = resolve; });
    return n;
  }, (_, n) => published.push(n), n => failures.push(n));
  queue.push(1); queue.push(2);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(failures, [1]);
  queue.push(3); queue.dispose(); release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, []);
});
