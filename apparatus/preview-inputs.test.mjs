import test from 'node:test';
import assert from 'node:assert/strict';
import {previewInputs,guidedStart} from './preview-inputs.mjs';
test('manual numeric inputs resume automatic experiments without a parameter jump',()=>{
 for(const [id,key,max] of [['relay','coilCurrent',1.2],['rheostat','position',1],['pulley','pullDistance',.6],['manometer','depth',.5],['submarine','ballast',32]]){
  for(let n=0;n<=20;n++){const value=max*n/20,t=guidedStart(id,{[key]:value});assert(Math.abs(previewInputs(id,t)[key]-value)<1e-9,`${id} input ${value}`);}
  assert.notDeepEqual(previewInputs(id,1),previewInputs(id,2),`${id} operation changes over time`);
 }
});
test('all distinct electroscope operations survive playback resume',()=>{
 for(const operation of ['neutral','near','move-away','contact','grounded','isolated','induction-done']){
  const t=guidedStart('electroscope',{operation});assert.equal(previewInputs('electroscope',t+.01).operation,operation);
 }
});
