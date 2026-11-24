export const pointVertex = /* glsl */`
attribute float aSize;
attribute float aSeed;
varying vec3 vColor;
varying float vAlpha;
uniform float uTime;
uniform float uDpr;
uniform float uEnergy;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.);
  vColor=color;
  vAlpha=.65+.25*sin(aSeed+uTime*.45);
  gl_PointSize=clamp(aSize*uDpr*(27./-mv.z)*(1.+uEnergy*.25),.6,12.);
  gl_Position=projectionMatrix*mv;
}`;
export const pointFragment = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 p=gl_PointCoord-.5; float r=length(p);
  float core=exp(-r*r*62.);
  float glow=exp(-r*r*15.)*.35;
  float rays=pow(max(0.,1.-abs(p.x)*30.),4.)*exp(-abs(p.y)*10.)*.12;
  rays+=pow(max(0.,1.-abs(p.y)*30.),4.)*exp(-abs(p.x)*10.)*.12;
  float a=(core+glow+rays)*vAlpha;
  if(a<.015) discard;
  gl_FragColor=vec4(vColor*1.7,a);
}`;
export const nebulaVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const nebulaFragment = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return f;}
void main(){
 vec2 p=(vUv-.5)*vec2(2.6,2.2); float t=uTime*.006;
 float r=length(p), a=atan(p.y,p.x);
 vec2 warp=vec2(fbm(p*3.+t),fbm(p*3.+vec2(5.,-t)));
 float n=fbm(p*7.+warp*2.+t);
 float arms=pow(.5+.5*sin(a*3.-r*16.+n*3.),5.);
 float radial=exp(-r*r*3.5)*smoothstep(.07,.3,r);
 float cloud=pow(n,2.35)*radial*(.18+arms*1.05);
 vec3 blue=vec3(.16,.22,.47), violet=vec3(.38,.29,.5), gold=vec3(.66,.43,.21);
 vec3 col=mix(blue,violet,smoothstep(.33,.68,warp.y));
 col=mix(col,gold,arms*exp(-r*2.)*.5);
 float heart=exp(-r*r*110.);
 gl_FragColor=vec4(col,cloud*.52+heart*.07);
}`;
