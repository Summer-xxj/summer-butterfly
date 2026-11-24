import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticleField } from '../src/physics/particles.js';
import { GestureEngine } from '../src/interaction/gestures.js';

test('particle world remains bounded through 15 simulated minutes of forces, releases and expansion', () => {
  const field = new ParticleField(800, 42), g = new GestureEngine();
  const s = g.update([],1/60);
  for (let i=0;i<27000;i++) {
    s.x=Math.sin(i*.02)*.6; s.y=Math.cos(i*.013)*.5; s.influence=i%400<300?1:0;
    s.collapse=(Math.sin(i*.01)+1)/2; s.scale=.65+(i%600)/600;
    s.release=i%200===0?1:0;
    field.update(1/30,i/30,s);
  }
  assert.ok(field.positions.every(v=>Number.isFinite(v)&&Math.abs(v)<60));
  assert.ok(field.velocities.every(v=>Number.isFinite(v)&&Math.abs(v)<=6.01));
});
test('expansion changes particle coordinates and reset restores exact initial population', () => {
  const f = new ParticleField(300,42), g=new GestureEngine();
  const initial=f.positions.slice(), s=g.update([],1/60); s.scale=1.9;
  for(let i=0;i<300;i++) f.update(1/60,i/60,s);
  const radius=a=>a.reduce((sum,v)=>sum+v*v,0);
  assert.ok(radius(f.positions)>radius(initial)*1.3);
  f.reset(); assert.deepEqual(f.positions, initial); assert.ok(f.velocities.every(v=>v===0));
});
test('release applies radial velocity instead of replacing particle positions', () => {
  const f=new ParticleField(200,12), s=new GestureEngine().update([],1/60);
  const initial=f.positions.slice(); s.release=1; f.update(1/60,0,s);
  assert.ok(f.velocities.some(v=>Math.abs(v)>.5));
  assert.ok(f.positions.every((v,i)=>Math.abs(v-initial[i])<.12));
});
