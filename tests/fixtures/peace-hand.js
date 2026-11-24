// Synthetic landmarks in MediaPipe's index order.
export function peaceFrame(scale = .1, extended = [0, 1], thumb = true) {
  const points = Array.from({length:21}, () => ({x:.5,y:.53,z:0}));
  const place = (i,x,y) => { points[i] = {x:.5+x*scale,y:.53+y*scale,z:0}; };
  for (const [finger,pip,tip,x] of [[0,6,8,-.4],[1,10,12,0],[2,14,16,.3],[3,18,20,.6]]) {
    place(pip,x,-1.15);
    place(tip,x,extended.includes(finger) ? -1.85 : -.87);
  }
  place(9,0,-1);
  place(5,-.4,-.85);
  place(17,.6,-.8);
  place(2,-.45,-.35);
  place(4,thumb ? -1.1 : -.28,thumb ? -.51 : -.89);
  return {landmarks:[points],handedness:[[{categoryName:'Left',score:.98}]]};
}
