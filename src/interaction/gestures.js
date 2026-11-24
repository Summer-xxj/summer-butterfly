import { CONFIG as C, clamp, damp } from '../themes/celestial.js';

// Pure input interpretation: no DOM, rendering, camera or wall-clock dependency.
export class GestureEngine {
  constructor() { this.reset(); }
  reset() {
    this.state = { x: 0, y: 0, influence: 0, energy: 0, collapse: 0,
      scale: 1, release: 0, releaseGlow: 0, birth: false, incubation: 0, hands: 0, mode: 'drift', attractors: [] };
    this.gathered = 0; this.armed = false; this.open = 1;
    this.lost = 0; this.peace = null; this.releaseCooldown = 0;
    this.primary = null;
  }
  updatePeace(hands, dt) {
    const s = this.state;
    const current = this.peace;
    const hand = current
      ? hands.find(hand => hand.id === current.id && hand.peace)
      : hands.find(hand => hand.peace);
    if (!hand) {
      if (current?.fired) {
        current.rest += dt;
        if (current.rest >= C.peaceRearm) this.peace = null;
      } else this.peace = null;
      return false;
    }
    const pose = this.peace ??= {id:hand.id, hold:0, rest:0, fired:false};
    pose.rest = 0;
    if (pose.fired) return true;
    // The render loop may see the same detection several times between camera frames.
    const elapsed = Number.isFinite(hand.timestamp)
      ? clamp((hand.timestamp - (pose.sample ?? hand.timestamp))/1000, 0, .10)
      : dt;
    pose.sample = hand.timestamp;
    pose.hold += elapsed;
    s.x = hand.peaceX ?? hand.x;
    s.y = hand.peaceY ?? hand.y;
    s.mode = 'incubation';
    s.incubation = clamp(.18 + .82 * pose.hold / C.peaceHold);
    if (pose.hold >= C.peaceHold) {
      pose.fired = true;
      s.birth = true;
      s.incubation = 0;
    }
    return true;
  }
  update(input, dt) {
    dt = clamp(dt, .001, .05);
    const s = this.state;
    const hands = input.filter(h => h.confidence >= C.confidence && [h.x,h.y,h.openness].every(Number.isFinite)).slice(0,2);
    s.release = 0; s.releaseGlow = Math.max(0,s.releaseGlow-dt); s.birth = false; s.hands = hands.length;
    this.releaseCooldown = Math.max(0, this.releaseCooldown - dt);
    if (!hands.length) {
      this.lost += dt;
      this.updatePeace(hands,dt);
      s.influence = damp(s.influence, 0, 3, dt);
      s.energy = damp(s.energy, 0, .8, dt);
      s.collapse = damp(s.collapse, 0, 2, dt);
      s.incubation = damp(s.incubation, 0, 5, dt);
      s.mode = 'drift';
      if (this.lost > C.handGrace) {
        this.armed = false; this.gathered = 0; this.primary = null;
      }
      return s;
    }
    this.lost = 0;
    const h = hands.find(h => h.id === this.primary) || hands[0];
    if (this.primary !== h.id) { this.armed = false; this.gathered = 0; this.open = h.openness; }
    this.primary = h.id;
    const previousOpen = this.open;
    this.open = damp(this.open, clamp(h.openness), 14, dt);
    const openingSpeed = (this.open - previousOpen) / dt;
    s.x = damp(s.x, h.x, 12, dt); s.y = damp(s.y, h.y, 12, dt);
    s.influence = damp(s.influence, 1, 5, dt);
    s.attractors = hands.filter(p => p !== h);
    s.depth = damp(s.depth || 0, h.z || 0, 8, dt);
    s.motion = damp(s.motion || 0, h.speed || 0, 5, dt);
    s.mode = 'attraction';
    if (this.updatePeace(hands,dt)) {
      this.armed = false;
      this.gathered = 0;
      s.collapse = damp(s.collapse,0,9,dt);
      s.energy = damp(s.energy,0,7,dt);
      return s;
    }
    s.incubation = damp(s.incubation,0,10,dt);
    s.collapse = damp(s.collapse, 1 - this.open, 9, dt);
    if (this.open > .62 && !this.armed) this.gathered = Math.min(2, this.gathered + dt);
    if (this.open < .4 && this.gathered > C.gatherTime) {
      this.armed = true;
      s.energy = clamp(s.energy + dt * .65 * (1 - this.open), 0, C.maxEnergy);
    }
    if (this.armed && this.open > .68) {
      if (s.energy >= .08 && this.releaseCooldown === 0) {
        s.release = clamp(s.energy * (.35 + Math.max(0, openingSpeed) * .5), .06, 1);
        this.releaseCooldown = 1.3; s.releaseGlow = 1;
      }
      this.armed = false; this.gathered = 0; s.energy *= .12;
    }
    if (!this.armed) s.energy = damp(s.energy, 0, .4, dt);
    s.mode = s.release ? 'release' : this.open < .45 ? 'collapse' : 'attraction';
    if (hands.length === 2 && Math.min(hands[0].openness,hands[1].openness) > .58) {
      const [a,b] = hands;
      const distance = Math.hypot((a.nx??a.x)-(b.nx??b.x),(a.ny??a.y)-(b.ny??b.y));
      s.scale = damp(s.scale, clamp(.65 + distance * .8, .65, 1.95), 3, dt);
      if (!s.release) s.mode = 'expansion';
    }
    return s;
  }
}
