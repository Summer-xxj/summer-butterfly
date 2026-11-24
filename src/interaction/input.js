import { GestureEngine } from './gestures.js';
import { clamp, damp } from '../themes/celestial.js';
export class InputController {
  constructor(canvas,world,camera,onAwake) {
    this.canvas=canvas;this.world=world;this.camera=camera;this.onAwake=onAwake;
    this.engine=new GestureEngine();this.mode='mouse';this.enabled=false;
    this.pointer={x:0,y:0,down:false,present:false};this.mouseScale=1;this.mouseHeld=0;
    this.demoAge=-1;this.demoOrigin={x:0,y:0};this.lastDemo=-20;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    const position=event=>{
      const nx=event.clientX/innerWidth*2-1,ny=1-event.clientY/innerHeight*2;
      Object.assign(this.pointer,this.world.mapInput(nx,ny),{present:true});
    };
    canvas.addEventListener('pointermove',event=>{if(this.mode==='mouse')position(event);},options);
    canvas.addEventListener('pointerdown',event=>{
      if(this.mode!=='mouse'||!this.enabled||event.button!==0)return;
      position(event);this.pointer.down=true;this.mouseHeld=0;canvas.setPointerCapture(event.pointerId);this.onAwake();
    },options);
    const up=()=>{this.pointer.down=false;};
    canvas.addEventListener('pointerup',up,options);canvas.addEventListener('pointercancel',up,options);
    canvas.addEventListener('pointerleave',()=>{if(!this.pointer.down)this.pointer.present=false;},options);
    window.addEventListener('blur',()=>{up();this.pointer.present=false;},options);
    canvas.addEventListener('wheel',event=>{
      if(this.mode!=='mouse'||!this.enabled)return;event.preventDefault();
      this.mouseScale=clamp(this.mouseScale-event.deltaY*.001,.65,1.95);this.onAwake();
    },{...options,passive:false});
    canvas.addEventListener('dblclick',event=>{if(this.mode==='mouse'&&this.enabled){position(event);this.beginLife();}},options);
  }
  setMode(mode){this.mode=mode;this.engine.reset();this.pointer.down=false;this.pointer.present=false;this.mouseHeld=0;this.demoAge=-1;}
  beginLife() {
    const now=performance.now()/1000;
    if(now-this.lastDemo<8 || this.demoAge>=0)return;
    this.lastDemo=now;this.demoAge=0;this.demoOrigin={x:this.pointer.x,y:this.pointer.y};this.onAwake();
  }
  update(dt) {
    if(this.mode==='hands') {
      const mapped=this.camera.getHands().map(h=>{
        const peace=this.world.mapInput(h.peaceX ?? h.x,h.peaceY ?? h.y);
        return {...h,nx:h.x,ny:h.y,...this.world.mapInput(h.x,h.y),peaceX:peace.x,peaceY:peace.y};
      });
      return this.engine.update(mapped,dt);
    }
    if(this.pointer.down)this.mouseHeld+=dt;
    const hands=this.enabled&&this.pointer.present?[{id:'mouse',x:this.pointer.x,y:this.pointer.y,
      openness:this.pointer.down&&this.mouseHeld>.55?Math.max(0,1-(this.mouseHeld-.55)*2):1,confidence:1}]:[];
    const s=this.engine.update(hands,dt);s.scale=damp(s.scale,this.mouseScale,3,dt);
    if(this.demoAge>=0) {
      this.demoAge+=dt;s.x=this.demoOrigin.x;s.y=this.demoOrigin.y;
      s.incubation=clamp(this.demoAge/2);s.mode='incubation';s.influence=Math.max(.6,s.influence);
      if(this.demoAge>=2.5){s.birth=true;s.incubation=0;this.demoAge=-1;}
    }
    return s;
  }
  reset(){this.engine.reset();this.pointer.down=false;this.pointer.present=false;this.mouseScale=1;this.mouseHeld=0;this.demoAge=-1;this.lastDemo=-20;}
  dispose(){this.abort.abort();}
}
