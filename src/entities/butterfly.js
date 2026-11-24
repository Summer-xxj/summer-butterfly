import * as THREE from 'three';
import { CONFIG, THEME, clamp, damp } from '../themes/celestial.js';
import { randomGenerator } from '../physics/particles.js';

// The membrane and its markings move together from the cocoon to the open wing.
const wingVertex = /* glsl */`
  varying vec2 vWing;
  uniform float uReveal;
  uniform float uTime;
  void main() {
    vWing = position.xy;
    float y = position.y;
    vec3 cocoon = vec3(0.04 * (1. + sin(y * 8.)), y * .2, cos(y * 8.) * .11);
    vec3 wing = vec3(position.xy, position.x * sin(uTime * 2.) * .025);
    vec3 p = mix(cocoon, wing, uReveal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }
`;

const membraneFragment = /* glsl */`
  varying vec2 vWing;
  uniform float uReveal;
  uniform float uAlpha;
  uniform float uTime;
  void main() {
    float angle = atan(vWing.y, vWing.x + .10);
    float radius = length(vWing);
    float ribs = pow(.5 + .5 * sin(angle * 17. + sin(radius * 4.) * .5), 18.);
    float grain = pow(.5 + .5 * sin(vWing.x * 104. + vWing.y * 77.) *
                                          sin(vWing.y * 97. - vWing.x * 63.), 14.);
    float silk = .5 + .5 * sin(radius * 7. - angle * 2. + uTime * .35);
    vec3 shadow = vec3(.20, .20, .37);
    vec3 gold = vec3(.62, .43, .23);
    vec3 color = mix(shadow, gold, .55 + .32 * silk);
    color += vec3(.29, .28, .24) * (ribs * .48 + grain * .36);
    float alpha = (.19 + silk * .10 + ribs * .14 + grain * .14) * uAlpha;
    gl_FragColor = vec4(color, alpha * mix(.33, 1., uReveal));
  }
`;

const markingFragment = /* glsl */`
  uniform float uReveal;
  uniform float uAlpha;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * uAlpha * smoothstep(.18, .94, uReveal));
  }
`;

function wingShape(){
  const s=new THREE.Shape();s.moveTo(0,.3);
  s.bezierCurveTo(.48,.88,1.25,1.67,2.03,1.87);
  s.bezierCurveTo(1.98,1.16,1.52,.46,1.12,.12);
  s.bezierCurveTo(1.44,.12,1.56,-.03,1.42,-.3);
  s.bezierCurveTo(1.18,-.76,.78,-.92,.51,-2.06);
  s.bezierCurveTo(.48,-1.31,.28,-.9,.13,-.63);
  s.bezierCurveTo(.02,-.39,0,-.25,0,-.17);
  s.lineTo(0,.3);return s;
}

class Butterfly {
  constructor(x,y,index) {
    this.age=0;this.reveal=0;this.seed=index*1.7;
    this.origin=new THREE.Vector3(x*10,y*6.2,2.5);this.group=new THREE.Group();
    this.group.position.copy(this.origin);this.group.scale.setScalar(.38);
    this.wings=[];
    this.wingUniforms={uReveal:{value:0},uTime:{value:0},uAlpha:{value:1}};
    const shape=wingShape(),outline=shape.getPoints(36);
    const surfaceOptions={
      vertexShader:wingVertex,transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    };
    const markings=(color,opacity)=>new THREE.ShaderMaterial({
      ...surfaceOptions, fragmentShader:markingFragment,
      uniforms:{...this.wingUniforms,uColor:{value:new THREE.Color(color)},uOpacity:{value:opacity}},
    });
    for(const side of [-1,1]) {
      const wing=new THREE.Group();
      wing.scale.x=side;
      const membrane=new THREE.ShaderMaterial({
        ...surfaceOptions, fragmentShader:membraneFragment, uniforms:this.wingUniforms,
      });
      wing.add(new THREE.Mesh(new THREE.ShapeGeometry(shape,36),membrane));
      wing.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline),markings(THEME.gold,.32)));

      const curves=[];
      for(let k=0;k<8;k++) {
        const end=shape.getPointAt(.09+k*.091);
        const curve=new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(.021,.047,0),
          new THREE.Vector3(end.x*.39,end.y*.69,0),
          new THREE.Vector3(end.x,end.y,0),
        );
        const points=curve.getPoints(24);
        for(let i=1;i<points.length;i++)curves.push(points[i-1],points[i]);
      }
      wing.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(curves),markings(THEME.gold,.21)));
      this.wings.push(wing);
      this.group.add(wing);
    }
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.029,.54,4,8),new THREE.MeshBasicMaterial({
      color:THEME.gold,transparent:true,opacity:.72,depthWrite:false,
    }));
    this.body=body;
    this.group.add(body);
    const antenna=[];
    for(const side of [-1,1]) {
      const c=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,.29,.02),new THREE.Vector3(side*.05,.55,0),new THREE.Vector3(side*.2,.63,0));
      const pts=c.getPoints(20);for(let i=1;i<pts.length;i++)antenna.push(pts[i-1],pts[i]);
    }
    this.antenna=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(antenna),new THREE.LineBasicMaterial({color:THEME.gold,transparent:true,opacity:.45,depthWrite:false}));
    this.group.add(this.antenna);
    this.dustCount=160;this.dustPositions=new Float32Array(this.dustCount*3);
    this.dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(this.dustPositions,3)),new THREE.PointsMaterial({color:THEME.gold,size:.028,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.dust.frustumCulled=false;this.history=Array.from({length:80},()=>this.origin.clone());this.historyIndex=0;
  }
  update(dt,time) {
    this.age+=dt;this.reveal=clamp((this.age-.4)/3.2);const r=this.reveal;
    const smooth=r*r*(3-2*r),free=Math.max(0,this.age-4);
    this.group.position.set(this.origin.x+Math.sin(free*.24+this.seed)*Math.min(3.8,free*.28),
      this.origin.y+Math.sin(free*.38)*1.1+Math.min(2,free*.1),
      this.origin.z+Math.sin(free*.3+this.seed)*1.5);
    this.group.rotation.set(Math.sin(free*.3)*.12,Math.sin(free*.24+this.seed)*.3,Math.sin(free*.4+this.seed)*.14);
    this.group.scale.setScalar(.3+smooth*.49);
    const flap=Math.sin(time*(this.age<5?3.5:4.5)+this.seed)*(.15+smooth*.5);
    const fade=clamp((125-this.age)/10);
    this.wingUniforms.uReveal.value=smooth;
    this.wingUniforms.uTime.value=time;
    this.wingUniforms.uAlpha.value=fade;
    this.body.material.opacity=.72*fade*smooth;
    this.antenna.material.opacity=.45*fade*smooth;
    for(let i=0;i<2;i++) {
      this.wings[i].rotation.y=(i===0?-1:1)*(.12+flap);
    }
    this.historyIndex=(this.historyIndex+1)%80;this.history[this.historyIndex].copy(this.group.position);
    for(let i=0;i<this.dustCount;i++) {
      const h=this.history[(this.historyIndex+80-Math.floor(i/2))%80],j=i*3;
      const spread=i/this.dustCount*.4;
      this.dustPositions[j]=h.x+Math.sin(i*37+time*.2)*spread;
      this.dustPositions[j+1]=h.y-i/this.dustCount*.5+Math.cos(i*23)*spread;
      this.dustPositions[j+2]=h.z+Math.sin(i*19)*spread;
    }
    this.dust.material.opacity=.42*smooth*fade;
    this.dust.geometry.attributes.position.needsUpdate=true;
  }
  dispose(scene) {
    scene.remove(this.group,this.dust);
    this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    this.dust.geometry.dispose();this.dust.material.dispose();
  }
}

export class LifeSystem {
  constructor(scene) {
    this.scene=scene;this.creatures=[];this.serial=0;
    const g=new THREE.BufferGeometry(),p=new Float32Array(600*3),r=randomGenerator(173);
    for(let i=0;i<600;i++){const a=r()*Math.PI*2,y=(r()-.5)*2.2,rad=Math.sqrt(1-Math.min(1,y*y/1.3))*.65;p.set([Math.cos(a)*rad,y,Math.sin(a)*rad],i*3);}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    this.cocoon=new THREE.Points(g,new THREE.PointsMaterial({color:THEME.gold,size:.025,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.scene.add(this.cocoon);
  }
  spawn(x,y) {
    if(this.creatures.length>=CONFIG.maxButterflies) this.remove(this.creatures[0]);
    const b=new Butterfly(x,y,this.serial++);this.creatures.push(b);this.scene.add(b.group,b.dust);
  }
  remove(b) {b.dispose(this.scene);this.creatures.splice(this.creatures.indexOf(b),1);}
  update(dt,time,s) {
    this.cocoon.material.opacity=damp(this.cocoon.material.opacity,s.incubation*.7,5,dt);
    this.cocoon.visible=this.cocoon.material.opacity>.005;
    this.cocoon.position.set(s.x*10,s.y*6.2,2.5);
    this.cocoon.rotation.y=time*.9;this.cocoon.rotation.z=Math.sin(time*.5)*.2;
    this.cocoon.scale.setScalar(.15+s.incubation*.8+Math.sin(time*2)*.04);
    for(const b of [...this.creatures]) {b.update(dt,time);if(b.age>125)this.remove(b);}
  }
  reset() {for(const b of [...this.creatures]) this.remove(b);this.cocoon.material.opacity=0;this.serial=0;}
  dispose() {this.reset();this.scene.remove(this.cocoon);this.cocoon.geometry.dispose();this.cocoon.material.dispose();}
}
