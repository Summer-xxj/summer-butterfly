import { clamp, CONFIG } from '../themes/celestial.js';
export function randomGenerator(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15,1 | seed); t ^= t+Math.imul(t ^ t >>> 7,61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export class ParticleField {
  constructor(count = CONFIG.particleCount, seed = 3718) {
    this.count=count; this.positions=new Float32Array(count*3);
    this.rest=new Float32Array(count*3); this.velocities=new Float32Array(count*3);
    this.colors=new Float32Array(count*3); this.sizes=new Float32Array(count);
    this.seeds=new Float32Array(count);
    const r=randomGenerator(seed);
    for(let i=0;i<count;i++) {
      const radius=Math.pow(r(),.68)*10.8+.12;
      const arm=i%3, angle=radius*.67+arm*Math.PI*2/3+(r()-.5)*(.24+radius*.065);
      const spread=(r()-.5)*(r()-.5)*radius*.44;
      const x=Math.cos(angle)*radius+spread;
      const z=Math.sin(angle)*radius;
      const y=(r()-.5)*(.22+radius*.15)+(r()<.07?(r()-.5)*4:0);
      // Inclined disk is stored in world space; forces can pull particles out of it.
      this.rest.set([x*.95+z*.22, z*.39+y*.9, -z*.73+y*.45],i*3);
      const gold=r()<.64, brightness=.45+r()*.65;
      this.colors.set(gold?[.83*brightness,.63*brightness,.37*brightness]:[.38*brightness,.49*brightness,.86*brightness],i*3);
      this.sizes[i]=r()<.025?2.8+r()*2.5:.45+Math.pow(r(),3)*2.2;
      this.seeds[i]=r()*100;
    }
    this.reset();
  }
  reset() { this.positions.set(this.rest); this.velocities.fill(0); }
  update(dt,time,s,activeCount=this.count) {
    dt=clamp(dt,.001,.04);
    const p=this.positions,v=this.velocities,b=this.rest;
    const a=time*.012,co=Math.cos(a),si=Math.sin(a);
    const fx=s.x*10,fy=s.y*6.2,fz=(s.depth||0)*5;
    const influence=s.influence,collapse=s.collapse;
    const swirlStrength=.8+.1*(s.motion||0);
    const scale=s.scale || 1, damping=Math.exp(-dt*.65);
    for(let i=0;i<activeCount;i++) {
      const j=i*3,x=p[j],y=p[j+1],z=p[j+2];
      const bx=(b[j]*co-b[j+2]*si)*scale;
      const bz=(b[j]*si+b[j+2]*co)*scale;
      let ax=(bx-x)*.22,ay=(b[j+1]*scale-y)*.22,az=(bz-z)*.22;
      const dx=fx-x,dy=fy-y,dz=fz-z,dist2=dx*dx+dy*dy+dz*dz;
      const falloff=Math.exp(-dist2/26)*influence;
      const strength=falloff*(.6+collapse*3.3);
      ax+=dx*strength-dy*falloff*swirlStrength;
      ay+=dy*strength+dx*falloff*swirlStrength;
      az+=dz*strength;
      // A second palm has its own local field; midpoint remains available for life.
      if(s.attractors?.length && s.incubation<.05) {
        const second=s.attractors[0];
        const sx=second.x*10-x,sy=second.y*6.2-y;
        const pull=Math.exp(-(sx*sx+sy*sy+z*z)/24)*influence*(.25+.25*second.openness);
        ax+=sx*pull; ay+=sy*pull; az-=z*pull;
      }
      const swirl=Math.sin(time*.21+this.seeds[i]);
      ax+=swirl*.018; ay+=Math.cos(time*.17+this.seeds[i])*.02;
      if(s.release>0) {
        const d=Math.sqrt(dist2)+.18, impulse=s.release*7*Math.exp(-dist2/150);
        v[j]-=dx/d*impulse; v[j+1]-=dy/d*impulse; v[j+2]+=(-dz/d+swirl*.4)*impulse;
      }
      v[j]=(v[j]+ax*dt)*damping; v[j+1]=(v[j+1]+ay*dt)*damping; v[j+2]=(v[j+2]+az*dt)*damping;
      const speed2=v[j]*v[j]+v[j+1]*v[j+1]+v[j+2]*v[j+2];
      if(speed2>36) {const k=6/Math.sqrt(speed2); v[j]*=k;v[j+1]*=k;v[j+2]*=k;}
      p[j]=clamp(x+v[j]*dt,-45,45); p[j+1]=clamp(y+v[j+1]*dt,-35,35);p[j+2]=clamp(z+v[j+2]*dt,-35,35);
    }
  }
}
