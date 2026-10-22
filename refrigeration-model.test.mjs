import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSEMBLY_DURATION, COOLING_MACHINES, getCoolingLesson, coolingAt, assemblyAt } from './refrigeration-model.mjs';

test('the complete refrigerant cycle closes in gas, never liquid into compressor', () => {
  for (const kind of ['fridge', 'ac']) for (const operation of ['cool', 'heat']) {
    const { stages } = getCoolingLesson(kind, operation);
    assert.deepEqual(stages.map(s => s.id), ['compression', 'condensation', 'expansion', 'evaporation']);
    for (let i = 0; i < stages.length; i++) assert.equal(stages[i].phaseOut, stages[(i + 1) % 4].phaseIn);
    assert.equal(stages[0].phaseIn, 'gas');
    assert.equal(stages[0].phaseOut, 'gas');
    assert.equal(stages[2].phaseOut, 'mixture');
    assert.equal(stages[1].heat, 'release');
    assert.equal(stages[3].heat, 'absorb');
  }
});

test('heat pump changes exchanger roles without reversing compressor flow', () => {
  const cool = getCoolingLesson('ac', 'cool'), heat = getCoolingLesson('ac', 'heat');
  assert.deepEqual([cool.heatFrom, cool.heatTo], ['室内', '室外']);
  assert.deepEqual([heat.heatFrom, heat.heatTo], ['室外', '室内']);
  assert.equal(cool.condenser, heat.evaporator);
  assert.equal(cool.evaporator, heat.condenser);
  assert.equal(cool.compressorFlow, heat.compressorFlow);
  assert.equal(getCoolingLesson('fridge', 'heat').operation, 'cool');
});

test('scrubbing and assembly boundaries always return a usable stage or step', () => {
  for (const progress of [-5, 0, .2499, .25, .5, .75, 1, 5, NaN]) {
    const state = coolingAt({ progress });
    assert.ok(state.stage);
    assert.ok(state.stageProgress >= 0 && state.stageProgress <= 1);
  }
  assert.equal(coolingAt({ progress: 1 }).stage.id, 'evaporation');
  for (const kind of ['fridge', 'ac']) {
    const done = assemblyAt(kind, ASSEMBLY_DURATION);
    assert.equal(done.complete, true);
    assert.ok(COOLING_MACHINES[kind].parts.some(p => p.id === done.step.selected));
    assert.ok(assemblyAt(kind, -1).step);
  }
});
