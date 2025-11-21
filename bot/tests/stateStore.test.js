import assert from 'node:assert/strict';
import { createStateStore } from '../stateStore.js';

const run = async () => {
  const namespace = `state-test:${Date.now()}`;
  const store = createStateStore({ namespace, defaultTtlSeconds: 1 });

  await store.set('user-1', { step: 'initial' }, 1);
  const firstRead = await store.get('user-1');
  assert.equal(firstRead.step, 'initial', 'Initial state should be readable');

  await store.set('user-1', { step: 'updated' }, 1);
  const updated = await store.get('user-1');
  assert.equal(updated.step, 'updated', 'State updates should overwrite previous value');

  await store.delete('user-1');
  const afterDelete = await store.get('user-1');
  assert.equal(afterDelete, undefined, 'Deleted state should return undefined');

  const donationStore = createStateStore({ namespace: `${namespace}:donations`, defaultTtlSeconds: 1 });
  await donationStore.set('pending', [{ donationId: 1, amount: 10 }], 1);
  const pending = await donationStore.get('pending');
  pending.push({ donationId: 2, amount: 25 });
  await donationStore.set('pending', pending, 1);
  const updatedPending = await donationStore.get('pending');
  assert.equal(updatedPending.length, 2, 'Pending donation collections should persist mutations');

  await donationStore.clearAll();
  const cleared = await donationStore.get('pending');
  assert.equal(cleared, undefined, 'clearAll should remove namespaced keys');

  console.log('✅ stateStore smoke tests passed');
};

run().catch((err) => {
  console.error('❌ stateStore smoke tests failed', err);
  process.exit(1);
});
