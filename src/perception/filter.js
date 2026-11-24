import { clamp, damp, CONFIG } from '../themes/celestial.js';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));

export class HandFilter {
  constructor() { this.previous = new Map(); this.events = []; }
  reset() { this.previous.clear(); this.events = []; }
  process(result, timestamp) {
    const hands = [];
    this.events = [];
    const detections = [];
    for (const [i, points] of (result.landmarks || []).entries()) {
      if (points.length !== 21 || !points.every(p => [p.x, p.y, p.z].every(Number.isFinite))) continue;
      const category = (result.handedness || result.handednesses)?.[i]?.[0];
      const confidence = category?.score || 0;
      if (confidence < CONFIG.confidence) continue;
      const id = category.categoryName || `hand-${i}`;
      const palm = [0, 5, 9, 13, 17].reduce((center, index) => ({
        x: center.x + points[index].x / 5,
        y: center.y + points[index].y / 5,
        z: center.z + points[index].z / 5,
      }), { x: 0, y: 0, z: 0 });
      detections.push({ id, points, confidence, palm });
      if (detections.length === 2) break;
    }
    const [first, second] = detections;
    if (second && first.id === second.id) {
      second.id += '-2';
      const previousFirst = this.previous.get(first.id);
      const previousSecond = this.previous.get(second.id);
      if (previousFirst && previousSecond && timestamp - Math.min(previousFirst.timestamp, previousSecond.timestamp) <= 500) {
        const gap = (detection, prior) => Math.hypot(1 - 2 * detection.palm.x - prior.x, 1 - 2 * detection.palm.y - prior.y);
        const sameOrder = gap(first, previousFirst) + gap(second, previousSecond);
        const newOrder = gap(first, previousSecond) + gap(second, previousFirst);
        if (newOrder + .08 < sameOrder) [first.id, second.id] = [second.id, first.id];
      }
    }
    for (const {id, points, confidence, palm} of detections) {
      const size = Math.max(.015, distance(points[0],points[9]));
      // Finger extension relative to the wrist/palm scale, not raw image size.
      const fingers = [];
      for (const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]]) {
        const extension = (distance(points[tip],points[0])-distance(points[pip],points[0])) / size;
        const straightness = clamp((extension + .02) / .72);
        fingers.push(straightness);
      }
      const [index, middle, ring, little] = fingers;
      const openness = (index + middle + ring + little) / 4;
      let old = this.previous.get(id);
      if (old && timestamp-old.timestamp > 500) old = null;
      // Compare to the hand's own size, with slightly wider thresholds once recognized.
      const palmSize = Math.max(size, distance(points[5],points[17]));
      const extended = old?.peace ? .32 : .43;
      const folded = old?.peace ? .43 : .34;
      const thumbSpread = distance(points[4],points[5]) / palmSize;
      const thumbReach = (distance(points[4],points[5])-distance(points[2],points[5])) / palmSize;
      const peace = index > extended && middle > extended && ring < folded && little < folded
        && thumbSpread > (old?.peace ? .30 : .36) && thumbReach > (old?.peace ? .06 : .12)
        && distance(points[8],points[12]) / palmSize > (old?.peace ? .14 : .20);
      const peaceX = 1 - points[8].x - points[12].x;
      const peaceY = 1 - points[8].y - points[12].y;
      const raw = {x:(.5-palm.x)*2,y:(.5-palm.y)*2,z:clamp(-palm.z,-.5,.5),openness};
      const dt = old ? clamp((timestamp-old.timestamp)/1000,.01,.12) : .04;
      const x = old ? damp(old.x,raw.x,16,dt) : raw.x;
      const y = old ? damp(old.y,raw.y,16,dt) : raw.y;
      const speed = old ? damp(old.speed, Math.min(5,Math.hypot(x-old.x,y-old.y)/dt),7,dt) : 0;
      const smoothedOpenness = old ? damp(old.openness, openness, 13, dt) : openness;
      const hand = { id,x,y,z:old?damp(old.z,raw.z,12,dt):raw.z,openness:smoothedOpenness,
        peace, peaceX: old ? damp(old.peaceX, peaceX, 20, dt) : peaceX,
        peaceY: old ? damp(old.peaceY, peaceY, 20, dt) : peaceY,
        confidence, speed, closed:1-smoothedOpenness, vx:old?(x-old.x)/dt:0,vy:old?(y-old.y)/dt:0,
        fingertips:[4,8,12,16,20].map(n => ({x:(.5-points[n].x)*2,y:(.5-points[n].y)*2})),
        appeared:!old, duration:old?old.duration+dt:0, timestamp };
      if (!old) this.events.push({type:'appear',id});
      this.previous.set(id,hand); hands.push(hand);
    }
    for (const [id,old] of this.previous) if (timestamp-old.timestamp > 500) {
      this.previous.delete(id); this.events.push({type:'disappear',id});
    }
    return hands;
  }
}
