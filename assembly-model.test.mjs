import test from 'node:test';import assert from 'node:assert/strict';
import {assemblyAt,ASSEMBLY_STEPS,ASSEMBLY_DURATION,ASSEMBLY_STEP_SECONDS,ASSEMBLY_MOVE_SECONDS} from './assembly-model.mjs';
test('each teaching step preserves installed parts and hides future assemblies',()=>{
  ASSEMBLY_STEPS.forEach((_,i)=>{const s=assemblyAt(i*ASSEMBLY_STEP_SECONDS+ASSEMBLY_MOVE_SECONDS);assert.equal(s.index,i);ASSEMBLY_STEPS.forEach((step,j)=>{for(const id of step.parts){assert.equal(s.parts[id].visible,j<=i);assert.equal(s.parts[id].progress,j<=i?1:0);}});});
});
test('pausing and seeking the same time produce the same pose',()=>{const time=ASSEMBLY_STEP_SECONDS*2+ASSEMBLY_MOVE_SECONDS*.3,s=assemblyAt(time);assert.deepEqual(s,assemblyAt(time));for(const p of Object.values(s.parts))assert.ok(p.progress>=0&&p.progress<=1);assert.notDeepEqual(s,assemblyAt(time+ASSEMBLY_MOVE_SECONDS*.2));});
test('boundaries and end pose are complete, finite and reversible',()=>{assert.deepEqual(assemblyAt(-1),assemblyAt(0));assert.deepEqual(assemblyAt(NaN),assemblyAt(0));const end=assemblyAt(ASSEMBLY_DURATION);assert.ok(end.done);assert.equal(end.progress,1);for(const p of Object.values(end.parts))assert.deepEqual(p,{visible:true,progress:1});assert.deepEqual(assemblyAt(1000),end);assert.equal(assemblyAt(0).parts.spark.visible,false);});
