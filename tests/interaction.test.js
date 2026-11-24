import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine } from '../src/interaction/gestures.js';
import { HandFilter } from '../src/perception/filter.js';
import { peaceFrame } from './fixtures/peace-hand.js';

const hand = (x, openness = 1, id = 'Left') => ({ id, x, y: 0, z: 0, openness, confidence: .95, speed: 0 });
const step = (g, hands, n = 1) => { let s; for (let i = 0; i < n; i++) s = g.update(hands, 1 / 60); return s; };

test('ordinary open palms never release energy', () => {
  const g = new GestureEngine(); let releases = 0;
  for (let i = 0; i < 300; i++) releases += !!step(g, [hand(0)]).release;
  assert.equal(releases, 0);
});
test('only gathered and collapsed energy releases once, faster opening is stronger', () => {
  const run = (frames) => {
    const g = new GestureEngine(); step(g, [hand(0)], 70); step(g, [hand(0, 0)], 110);
    let peak = 0;
    for (let i = 1; i <= frames + 30; i++) peak = Math.max(peak, step(g, [hand(0, Math.min(1, i / frames))]).release || 0);
    assert.equal(step(g, [hand(0)], 20).release, 0);
    return peak;
  };
  assert.ok(run(3) > run(75));
  assert.ok(run(75) > 0);
});
test('energy saturates, and lost hands decay without releasing', () => {
  const g = new GestureEngine(); step(g, [hand(0)], 60); const s = step(g, [hand(0, 0)], 3600);
  assert.ok(s.energy <= 1 && s.energy > .5);
  let previous = s.influence;
  for (let i = 0; i < 120; i++) { const t = step(g, []); assert.equal(t.release, 0); assert.ok(t.influence <= previous); previous = t.influence; }
  assert.ok(previous < .02);
  assert.equal(step(g, [hand(0)], 30).release, 0);
});
test('ordinary scaling and fast close/open cannot hatch life', () => {
  const g = new GestureEngine(); let birth = 0;
  for (let i = 0; i < 250; i++) {
    const d = .2 + .5 * (1 + Math.sin(i * .12));
    birth += step(g, [hand(-d), hand(d, 1, 'Right')]).birth ? 1 : 0;
  }
  assert.equal(birth, 0);
});
const peace = (extra = {}) => ({
  ...hand(.15,.55), peace:true, peaceX:.27, peaceY:.22, ...extra,
});

test('one peace sign hatches from the fingertips, even if held for several seconds', () => {
  const g = new GestureEngine();
  assert.ok(step(g,[peace()],19).incubation>.45);
  let births = 0;
  for(let i=0;i<180;i++){
    const result=step(g,[peace()]);
    if(result.birth){
      births++;
      assert.equal(result.x,.27);
      assert.equal(result.y,.22);
    }
  }
  assert.equal(births,1);
  step(g,[hand(0)],23);
  let next=0;
  for(let i=0;i<36;i++) next+=!!step(g,[peace()]).birth;
  assert.equal(next,1);
});

test('a short peace sign or losing it before hatch cannot finish the hold', () => {
  for(const next of [[],[peace({confidence:.2})],[peace({id:'Right'})]]) {
    const g = new GestureEngine();
    step(g,[peace()],21);
    assert.equal(step(g,next).birth,false);
    const after=step(g,[peace()],20);
    assert.equal(after.birth,false);
    assert.ok(after.incubation<1);
  }
});

test('a peace sign does not trigger a pending energy release', () => {
  const g = new GestureEngine();
  step(g,[hand(0)],70);step(g,[hand(0,0)],70);
  let births=0;
  for(let i=0;i<36;i++){
    const result=step(g,[peace({openness:1})]);
    births+=!!result.birth;
    assert.equal(result.release,0);
  }
  assert.equal(births,1);
});

test('filter mirrors and smooths positions, rejects malformed frames', () => {
  const f = new HandFilter();
  const landmarks = Array.from({ length: 21 }, () => ({ x: .2, y: .4, z: 0 }));
  const result = { landmarks: [landmarks], handedness: [[{ categoryName: 'Left', score: .95 }]] };
  const a = f.process(result, 1000)[0]; assert.ok(a.x > 0);
  const old = a.x; landmarks.forEach(p => p.x = .8);
  const b = f.process(result, 1040)[0]; assert.ok(b.x < old && b.x > -.6);
  assert.deepEqual(f.process({ landmarks: [[{ x: NaN }]] }, 1100), []);
});
test('brief missing frame cannot reset smoothed hand position', () => {
  const f = new HandFilter();
  const make = x => ({ landmarks: [Array.from({ length: 21 }, () => ({ x, y: .4, z: 0 }))], handedness: [[{ categoryName: 'Left', score: .95 }]] });
  f.process(make(.2), 1000); f.process({ landmarks: [] }, 1040);
  assert.ok(f.process(make(.25), 1080)[0].x > .4);
});

test('a momentary close cannot arm a release after gathering', () => {
  const g = new GestureEngine();
  step(g, [hand(0)], 90);
  step(g, [hand(0, 0)], 6);
  let releases = 0;
  for (let i = 0; i < 60; i++) releases += !!step(g, [hand(0)]).release;
  assert.equal(releases, 0);
});

test('landmark filter detects a three-finger peace sign at both scales but rejects an open palm and a fist', () => {
  const recognize=(scale,fingers,thumb)=>new HandFilter().process(peaceFrame(scale,fingers,thumb),1000)[0];
  const near=recognize(.1,[0,1]),far=recognize(.045,[0,1]);
  assert.ok(near.peace && far.peace && near.peaceX>0 && near.peaceY>0);
  assert.equal(recognize(.1,[0,1,2,3]).peace,false);
  assert.equal(recognize(.1,[]).peace,false);
  assert.equal(recognize(.1,[0]).peace,false);
  assert.equal(recognize(.1,[0,1],false).peace,false);
});

test('ambiguous handedness keeps palms stable when detector order changes', () => {
  const f = new HandFilter();
  const frame = (...xs) => ({
    landmarks: xs.map(x => Array.from({length:21}, () => ({x,y:.4,z:0}))),
    handedness: xs.map(() => [{categoryName:'Right',score:.98}]),
  });
  const first = f.process(frame(.2,.8),1000);
  const next = f.process(frame(.79,.21),1040);
  const leftOnImage = next.find(h => h.id === first[0].id);
  assert.ok(leftOnImage.x > .5);
  assert.ok(leftOnImage.speed < .5);
});

test('repeated display frames cannot turn a single camera observation into a peace sign hold', () => {
  const g=new GestureEngine();
  for(let i=0;i<60;i++) assert.equal(step(g,[peace({timestamp:1000})]).birth,false);
  assert.ok(step(g,[peace({timestamp:1040})]).incubation<.4);
});
