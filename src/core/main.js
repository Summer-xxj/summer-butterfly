import { World } from '../rendering/world.js';
import { HandCamera } from '../perception/camera.js';
import { InputController } from '../interaction/input.js';
import { LifeSystem } from '../entities/butterfly.js';
import { Soundscape } from '../audio/sound.js';
import { Interface } from '../ui/interface.js';

export class Application {
  constructor(){
    this.time=0;this.last=performance.now();this.frames=0;this.running=true;this.disposed=false;
    this.metrics={frameMs:[],maxHands:0,releases:0,births:0};
    this.sound=new Soundscape();
    this.ui=new Interface({start:m=>this.start(m),camera:()=>this.toggleCamera(),sound:()=>this.toggleSound(),
      volume:v=>{this.sound.setVolume(v);this.savePreferences();},capture:()=>this.capture(),reset:()=>this.reset()});
    try{
      this.world=new World(document.getElementById('universe'));
      this.camera=new HandCamera(document.getElementById('camera-video'),(status,error)=>{
        this.ui.camera(status,error);
        if(status==='error'){this.input.setMode('mouse');this.input.enabled=true;}
      });
      this.input=new InputController(document.getElementById('universe'),this.world,this.camera,()=>this.ui.awake());
      this.life=new LifeSystem(this.world.scene);this.loadPreferences();
      this.onResize=()=>this.world.resize();window.addEventListener('resize',this.onResize);
      this.onVisibility=()=>{
        this.last=performance.now();if(document.hidden)this.sound.suspend();else if(this.ui.started)this.sound.resume()?.catch(()=>{});
      };
      document.addEventListener('visibilitychange',this.onVisibility);
      this.onPageHide=event=>{
        if(!event.persisted){this.dispose();return;}
        this.camera.stop();this.input.setMode('mouse');this.ui.camera('off');
      };
      window.addEventListener('pagehide',this.onPageHide);
      this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
    }catch(error){console.error(error);this.ui.fatal(error);this.running=false;}
  }
  loadPreferences(){try{const p=JSON.parse(localStorage.getItem('palmverse-preferences')||'{}');if(typeof p.volume==='number')this.sound.volume=Math.min(1,Math.max(0,p.volume));this.sound.muted=!!p.muted;this.ui.$('volume').value=this.sound.volume;this.ui.icon('sound-button',this.sound.muted?'mute':'sound');this.ui.$('sound-button').setAttribute('aria-pressed',String(this.sound.muted));}catch{}}
  savePreferences(){try{localStorage.setItem('palmverse-preferences',JSON.stringify({volume:this.sound.volume,muted:this.sound.muted}));}catch{}}
  async start(mode){
    if(!this.running)return;
    this.ui.enter();this.input.enabled=true;
    await this.sound.start().catch(()=>this.ui.toast('声音暂不可用，仍可探索宇宙 / Audio unavailable'));
    if(mode==='hands')await this.enableCamera();else{this.camera.stop();this.input.setMode('mouse');this.ui.camera('off');this.ui.toast('按住聚拢，松开释能。双击，唤醒生命。 / Hold, release, double-click.');}
  }
  async enableCamera(){
    try{const ready=await this.camera.start();if(ready)this.input.setMode('hands');}
    catch(error){this.camera.stop();this.input.setMode('mouse');this.ui.camera('error',error);}
  }
  async toggleCamera(){if(this.camera.active){this.camera.stop();this.input.setMode('mouse');this.ui.camera('off');this.ui.toast('鼠标已接管引力 / Mouse control ready');}else await this.enableCamera();}
  toggleSound(){this.sound.toggle();this.ui.icon('sound-button',this.sound.muted?'mute':'sound');this.ui.$('sound-button').setAttribute('aria-pressed',String(this.sound.muted));this.ui.$('sound-button').title=this.sound.muted?'开启声音 / Unmute':'静音 / Mute';this.savePreferences();}
  async capture(){
    const button=this.ui.$('capture-button');button.disabled=true;
    try{
      const blob=await this.world.capture(),url=URL.createObjectURL(blob),a=document.createElement('a');
      const date=new Date();const pad=n=>String(n).padStart(2,'0');
      a.href=url;a.download=`PALMVERSE_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
      a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);this.ui.toast('宇宙指纹已保存 / Your universe, captured.');
    }catch(error){this.ui.toast(`保存失败 / ${error.message}`);}finally{button.disabled=false;}
  }
  reset(){this.input.reset();this.life.reset();this.world.reset();this.sound.reset();this.time=0;this.ui.awake();this.ui.toast('万象归初，宇宙仍在 / A new beginning.');}
  loop(now){
    if(!this.running)return;this.raf=requestAnimationFrame(this.loop);
    if(document.hidden){this.last=now;return;}
    const elapsed=now-this.last;this.last=now;const dt=Math.min(.04,elapsed/1000);this.time+=dt;
    const s=this.input.update(dt);this.state=s;
    if(s.release){this.sound.tone('release',s.release);this.metrics.releases++;}
    if(s.birth){this.life.spawn(s.x,s.y);this.sound.tone('birth',.8);this.metrics.births++;this.ui.toast('一个新的生命，已从你的掌心醒来。 / A new life awakens.');}
    this.world.update(dt,this.time,s);this.life.update(dt,this.time,s);if(this.frames%4===0)this.sound.update(s);this.world.render();
    this.world.adapt(elapsed,dt);this.camera.inferenceFPS=this.world.fps<38?16:24;
    this.frames++;if(this.frames%12===0)this.ui.update(s,this.input.mode);
    if(this.frames%60===0){this.metrics.frameMs.push(this.world.frameEMA);if(this.metrics.frameMs.length>960)this.metrics.frameMs.shift();}
    this.metrics.maxHands=Math.max(this.metrics.maxHands,s.hands);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.running=false;cancelAnimationFrame(this.raf);
    window.removeEventListener('resize',this.onResize);window.removeEventListener('pagehide',this.onPageHide);document.removeEventListener('visibilitychange',this.onVisibility);
    this.camera?.stop();this.input?.dispose();this.life?.dispose();this.world?.dispose();this.sound.dispose();
  }
}
export const app=new Application();
