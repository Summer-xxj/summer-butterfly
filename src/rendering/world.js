import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ParticleField, randomGenerator } from '../physics/particles.js';
import { CONFIG, THEME, damp } from '../themes/celestial.js';
import { pointVertex, pointFragment, nebulaVertex, nebulaFragment } from './shaders.js';

export class World {
  constructor(canvas) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15;
    this.scene=new THREE.Scene();
    // Force the scene clear after the composer binds its linear HDR target.
    this.scene.background=new THREE.Color(THEME.background);
    this.camera=new THREE.PerspectiveCamera(47,1,.1,180);
    this.camera.position.set(0,0,26);
    this.field=new ParticleField(); this.activeCount=this.field.count;
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.field.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.field.colors,3));
    this.geometry.setAttribute('aSize',new THREE.BufferAttribute(this.field.sizes,1));
    this.geometry.setAttribute('aSeed',new THREE.BufferAttribute(this.field.seeds,1));
    this.uniforms={uTime:{value:0},uDpr:{value:1},uEnergy:{value:0}};
    this.material=new THREE.ShaderMaterial({vertexShader:pointVertex,fragmentShader:pointFragment,vertexColors:true,
      uniforms:this.uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    this.particles=new THREE.Points(this.geometry,this.material); this.particles.frustumCulled=false;
    this.scene.add(this.particles);
    this.createStars(); this.createNebula(); this.createTrails(); this.createCore();
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(640,400),.38,.55,.88);
    this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.flashes=[]; this.quality=1; this.slowSeconds=0; this.fastSeconds=0;
    this.frameEMA=16; this.fps=60; this.pointer=new THREE.Vector2(); this.resize();
  }
  createStars() {
    const r=randomGenerator(214),n=2600,positions=new Float32Array(n*3),colors=new Float32Array(n*3),sizes=new Float32Array(n),seeds=new Float32Array(n);
    for(let i=0;i<2200;i++) { positions.set([(r()-.5)*100,(r()-.5)*66,-12-r()*55],i*3);
      const c=.22+r()*.5; colors.set([c*.67,c*.76,c],i*3); sizes[i]=r()<.025?3+r()*3:.6+r(); seeds[i]=r()*80; }
    // Two distant galaxies are rendered as sparse clusters in the same star batch.
    for(let i=2200;i<n;i++) {
      const right=i<2400;
      const radius=Math.sqrt(r())*(right?2.6:1.8);
      const angle=radius*2.7+(i%2)*Math.PI+(r()-.5)*.7;
      const x=Math.cos(angle)*radius, y=Math.sin(angle)*radius*.38;
      positions.set([(right?29:-27)+x+y*.7,(right?14:-15)+y+x*.28,-42+(r()-.5)*.6],i*3);
      const light=.13+r()*.31;
      colors.set([light*.63,light*.69,light],i*3);
      sizes[i]=.8+r()*.75;
      seeds[i]=r()*80;
    }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));g.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    this.stars=new THREE.Points(g,this.material); this.scene.add(this.stars);
  }
  createNebula() {
    const mat=new THREE.ShaderMaterial({vertexShader:nebulaVertex,fragmentShader:nebulaFragment,
      uniforms:{uTime:this.uniforms.uTime},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    this.nebula=new THREE.Mesh(new THREE.PlaneGeometry(34,29),mat);
    this.nebula.rotation.set(-.8,.1,-.23); this.nebula.position.z=-3;
    this.scene.add(this.nebula);
    // Flowing silk filaments trace an irregular 3D disk; never concentric HUD rings.
    const positions=[],colors=[]; const r=randomGenerator(912);
    for(let k=0;k<24;k++) {
      const offset=r()*6.28,start=.8+r()*3.5,len=.8+r()*4;
      let last=null;
      for(let j=0;j<110;j++) {
        const radius=start+j/110*len,angle=radius*.67+offset;
        const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
        const p=[x*.95+z*.22,z*.39+Math.sin(radius*2+k)*.11,-z*.73];
        if(last) {positions.push(...last,...p); const c=.08+Math.sin(j/110*Math.PI)*.12; colors.push(c,c*.74,c*.42,c,c*.74,c*.42);}
        last=p;
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.filaments=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.13,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.scene.add(this.filaments);
  }
  createTrails() {
    this.trailCount=1400; this.trailPositions=new Float32Array(this.trailCount*6);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.trails=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:THEME.gold,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.trails.frustumCulled=false;this.scene.add(this.trails);
  }
  createCore() {
    const g=new THREE.PlaneGeometry(1,1);
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{uColor:{value:new THREE.Color(THEME.gold)},uPower:{value:1}},
      vertexShader:nebulaVertex,fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uPower;void main(){vec2 p=vUv-.5;float r=length(p);float a=exp(-r*r*36.)*.2+exp(-r*r*380.)*.45;gl_FragColor=vec4(uColor,a*uPower);}`});
    this.core=new THREE.Mesh(g,m);this.core.scale.setScalar(4);this.scene.add(this.core);
    this.handCore=new THREE.Mesh(g,m.clone()); this.handCore.visible=false;this.scene.add(this.handCore);
  }
  resize() {
    this.width=window.innerWidth;this.height=window.innerHeight;
    const dpr=Math.min(devicePixelRatio,CONFIG.maxDPR)*this.quality;
    this.renderer.setPixelRatio(dpr);this.renderer.setSize(this.width,this.height,false);
    this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
    this.camera.position.z=this.width<650?43:26;
    this.cameraBaseY=this.width<650?-4:0;
    this.camera.position.y=this.cameraBaseY;
    this.composer.setPixelRatio(dpr);this.composer.setSize(this.width,this.height);
    this.uniforms.uDpr.value=dpr;
  }
  mapInput(nx,ny) {
    const halfH=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*this.camera.position.z;
    return {x:(nx*halfH*this.camera.aspect+this.camera.position.x)/10,
      y:(ny*halfH+this.camera.position.y)/6.2};
  }
  pulse(x,y,power) {
    if(this.flashes.length>=4) this.removeFlash(this.flashes[0]);
    const material=new THREE.ShaderMaterial({
      transparent:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,
      uniforms:{uFade:{value:.2},uColor:{value:new THREE.Color(THEME.gold)}},
      vertexShader:nebulaVertex,
      fragmentShader:`varying vec2 vUv;
        uniform float uFade;
        uniform vec3 uColor;
        void main(){
          vec2 p=(vUv-.5)*2.;
          float angle=atan(p.y,p.x);
          float contour=.958+sin(angle*13.)*.013+sin(angle*27.)*.007;
          float rim=exp(-pow((length(p)-contour)*65.,2.));
          float gaps=.18+.82*pow(.5+.5*sin(angle*7.+sin(angle*15.)),2.);
          gl_FragColor=vec4(uColor,rim*gaps*uFade);
        }`,
    });
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.89,1,160),material);
    mesh.position.set(x*10,y*6.2,.5);mesh.rotation.x=.3;
    const f={mesh,age:0,power};this.flashes.push(f);this.scene.add(mesh);
  }
  removeFlash(f) {this.scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();this.flashes.splice(this.flashes.indexOf(f),1);}
  update(dt,time,s) {
    this.field.update(dt,time,s,this.activeCount);
    this.geometry.attributes.position.needsUpdate=true;
    this.uniforms.uTime.value=time;this.uniforms.uEnergy.value=s.energy;
    this.stars.rotation.z=time*.001;
    this.filaments.rotation.y=time*.012;this.filaments.scale.setScalar(s.scale);
    this.nebula.scale.setScalar(damp(this.nebula.scale.x,s.scale,1,dt));
    this.core.material.uniforms.uPower.value=1+Math.sin(time*.35)*.15;
    this.handCore.visible=s.influence>.03 || s.incubation>.01;
    this.handCore.position.set(s.x*10,s.y*6.2,.5+(s.depth||0)*5);
    this.handCore.scale.setScalar((1.3+s.energy*2+s.incubation*1.5)*(1+Math.sin(time*2)*.05));
    this.handCore.material.uniforms.uPower.value=s.influence*(.3+s.energy*1.8+s.incubation);
    if(s.release) this.pulse(s.x,s.y,s.release);
    const p=this.field.positions,v=this.field.velocities;
    for(let i=0;i<this.trailCount;i++) {
      const source=(i*7%this.activeCount)*3,target=i*6;
      for(let k=0;k<3;k++){this.trailPositions[target+k]=p[source+k];this.trailPositions[target+3+k]=p[source+k]-v[source+k]*(.08+s.energy*.12);}
    }
    this.trails.geometry.attributes.position.needsUpdate=true;
    this.trails.material.opacity=damp(this.trails.material.opacity,.12+s.energy*.15+s.influence*.08,3,dt);
    for(const f of [...this.flashes]) {
      f.age+=dt;f.mesh.scale.setScalar(.2+f.age*(3+f.power*5));f.mesh.material.uniforms.uFade.value=.22*Math.exp(-f.age*1.8);
      if(f.age>3) this.removeFlash(f);
    }
    this.camera.position.x=damp(this.camera.position.x,s.x*.16,1,dt);
    this.camera.position.y=damp(this.camera.position.y,this.cameraBaseY+s.y*.1,1,dt);
  }
  render() {this.composer.render();}
  adapt(frameMs,dt) {
    this.frameEMA=damp(this.frameEMA,frameMs,1,dt);this.fps=1000/this.frameEMA;
    this.slowSeconds=this.frameEMA>26?this.slowSeconds+dt:0;
    this.fastSeconds=this.frameEMA<18?this.fastSeconds+dt:0;
    if(this.slowSeconds>5 && this.quality>.65) {
      this.quality=Math.max(.65,this.quality-.15);this.slowSeconds=0;this.fastSeconds=0;
      this.activeCount=Math.max(CONFIG.minimumParticles,Math.round(this.field.count*this.quality));
      this.geometry.setDrawRange(0,this.activeCount);this.resize();
    } else if(this.fastSeconds>30 && this.quality<1) {
      this.quality=Math.min(1,this.quality+.1);this.fastSeconds=0;
      this.activeCount=Math.round(this.field.count*this.quality);this.geometry.setDrawRange(0,this.activeCount);this.resize();
    }
  }
  async capture() {
    const original=this.renderer.getPixelRatio();
    const ratio=Math.min(2,4096/Math.max(this.width,this.height));
    try {
      this.renderer.setPixelRatio(ratio);this.composer.setPixelRatio(ratio);
      this.uniforms.uDpr.value=ratio;this.render();
      const blob=await new Promise(resolve=>this.renderer.domElement.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('PNG export failed');return blob;
    } finally {
      this.renderer.setPixelRatio(original);this.composer.setPixelRatio(original);this.uniforms.uDpr.value=original;this.render();
    }
  }
  reset() {this.field.reset();for(const f of [...this.flashes]) this.removeFlash(f);}
  dispose() {
    for(const f of [...this.flashes]) this.removeFlash(f);
    const geometries=new Set(),materials=new Set();
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    this.composer.passes.forEach(p=>p.dispose?.());this.composer.dispose();this.renderer.dispose();
  }
}
