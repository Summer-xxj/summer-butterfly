export const THEME = {
  background: '#080D20', blue: '#304C85', violet: '#A49ACD', gold: '#DFC28F', silver: '#E2EAF5',
};
export const CONFIG = {
  particleCount: 14500, minimumParticles: 6500, maxButterflies: 6,
  cameraFPS: 24, confidence: .6, handGrace: .22,
  gatherTime: .4, peaceHold: .48, peaceRearm: .24,
  maxDPR: 1.5, maxSpeed: 6, maxEnergy: 1,
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
