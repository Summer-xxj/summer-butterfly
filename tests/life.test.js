import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { LifeSystem } from '../src/entities/butterfly.js';
test('life is bounded, moves independently and reset releases all owned scene objects',()=>{
  const scene=new Scene(), life=new LifeSystem(scene);
  for(let i=0;i<20;i++) life.spawn(0,0);
  assert.equal(life.creatures.length,6);
  const p=life.creatures[0].group.position.clone();
  for(let i=0;i<600;i++) life.update(1/60,i/60,{incubation:0,x:1,y:1});
  assert.ok(life.creatures[0].group.position.distanceTo(p)>1);
  assert.ok(life.creatures[0].reveal>.99);
  life.reset();assert.equal(life.creatures.length,0);assert.equal(scene.children.length,1);
  life.dispose();assert.equal(scene.children.length,0);
});
test('life fades out and removes geometry after its bounded lifetime',()=>{
  const scene=new Scene(),life=new LifeSystem(scene);life.spawn(.2,.1);
  for(let i=0;i<8000;i++)life.update(1/60,i/60,{incubation:0,x:0,y:0});
  assert.equal(life.creatures.length,0);life.dispose();
});
