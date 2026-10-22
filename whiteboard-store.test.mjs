import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardStore, WHITEBOARD_STORAGE_KEY } from './whiteboard-store.mjs';
const makeStorage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };
const board = () => ({ id: 'compression', contextKey: '汽油机270', title: '汽油机', detail: '压缩 · 270°', snapshot: { angle: 270 }, width: 1600, height: 900, updatedAt: 12, operations: [{ id: 'stroke', type: 'pen', color: '#1c73ff', width: 4, points: [[100, 50], [200, 120]] }] });
test('saved vector ink and teaching snapshot reopen without sharing mutable state', () => {
  const storage = makeStorage(), first = createBoardStore({ storage }), record = board();
  first.save(record); record.operations[0].points[0][0] = 999; assert.equal(first.flush(), true);
  const second = createBoardStore({ storage }), restored = second.find('汽油机270');
  assert.equal(restored.snapshot.angle, 270); assert.equal(restored.operations[0].points[0][0], 100);
  restored.operations.length = 0; assert.equal(second.get('compression').operations.length, 1); first.destroy(); second.destroy();
});
test('quota failure is explicit and retains the current memory copy', () => {
  const store = createBoardStore({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } });
  store.save(board()); assert.equal(store.flush(), false); assert.equal(store.status.state, 'error'); assert.equal(store.get('compression').operations.length, 1); store.destroy();
});
test('unreadable stored data is kept intact and never silently replaced', () => {
  const storage = makeStorage(); storage.setItem(WHITEBOARD_STORAGE_KEY, '{corrupt');
  const store = createBoardStore({ storage }); store.save(board()); assert.equal(store.flush(), false);
  assert.equal(storage.getItem(WHITEBOARD_STORAGE_KEY), '{corrupt'); assert.equal(store.status.state, 'error'); store.destroy();
});

test('device board collections stay separate while preserving existing engine boards', () => {
  const storage = makeStorage(), engine = createBoardStore({storage}), fridge = createBoardStore({storage,key:'thermal-energy-whiteboard-fridge'});
  engine.save(board()); engine.flush();
  const frozen = {...board(),id:'fridge-state',contextKey:'fridge-evaporator',title:'电冰箱',snapshot:{kind:'fridge',progress:.875}};
  fridge.save(frozen); fridge.flush();
  const restoredEngine = createBoardStore({storage}), restoredFridge = createBoardStore({storage,key:'thermal-energy-whiteboard-fridge'}), ac = createBoardStore({storage,key:'thermal-energy-whiteboard-ac'});
  assert.equal(restoredEngine.list()[0].title,'汽油机');
  assert.equal(restoredFridge.list()[0].snapshot.kind,'fridge');
  assert.equal(ac.list().length,0);
  [engine,fridge,restoredEngine,restoredFridge,ac].forEach(store=>store.destroy());
});
