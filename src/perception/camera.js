import { HandFilter } from './filter.js';
import { CONFIG } from '../themes/celestial.js';

export class HandCamera {
  constructor(video,onStatus) {
    this.video=video;this.onStatus=onStatus;this.filter=new HandFilter();
    this.hands=[];this.worker=null;this.stream=null;this.active=false;
    this.generation=0;this.pending=false;this.inferenceMs=0;this.lastResult=0;
    this.lastSent=0;this.lastVideoTime=-1;this.inferenceFPS=CONFIG.cameraFPS;this.timer=null;
  }
  async start() {
    this.stop();const token=this.generation;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('请从 localhost 打开体验 / Secure localhost required');
    this.onStatus('requesting');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
      if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
      this.stream=stream;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          if (token === this.generation) this.fail(new Error('摄像头已断开 / Camera disconnected'));
        }, { once: true });
      }
      this.video.srcObject=stream;await this.video.play();
      if(token!==this.generation)return false;
      this.onStatus('loading');await this.initialize(token);
      if(token!==this.generation)return false;
      this.active=true;this.onStatus('ready');this.tick(token);return true;
    } catch(error) {
      if(token!==this.generation)return false;
      this.stop();
      throw error;
    }
  }
  initialize(token=this.generation) {
    if(this.worker)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const worker=new Worker('/hand-worker.js');this.worker=worker;
      const timeout=setTimeout(()=>reject(new Error('本地手势模型加载超时 / Model timeout')),30000);
      this.cancelInit=()=>{clearTimeout(timeout);reject(new DOMException('Camera stopped','AbortError'));};
      worker.onerror=(event)=>{clearTimeout(timeout);const error=new Error(event.message||'手势线程启动失败');reject(error);if(this.active)this.fail(error);};
      worker.onmessage=({data})=>{
        if(token!==this.generation)return;
        if(data.type==='ready'){clearTimeout(timeout);this.cancelInit=null;resolve();}
        else if(data.type==='result'){
          this.pending=false;this.hands=this.filter.process(data,data.timestamp);
          this.lastResult=performance.now();this.inferenceMs=data.inferenceMs;
        } else if(data.type==='error') {
          clearTimeout(timeout);reject(new Error(data.message));if(this.active)this.fail(new Error(data.message));
        }
      };
      worker.postMessage({type:'init'});
    });
  }
  fail(error){this.stop();this.onStatus('error',error);}
  async tick(token) {
    if(token!==this.generation || !this.active)return;
    const now=performance.now();
    if(!document.hidden && !this.pending && this.video.readyState>=2 && this.video.currentTime!==this.lastVideoTime && now-this.lastSent>1000/this.inferenceFPS) {
      this.pending=true;this.lastSent=now;this.lastVideoTime=this.video.currentTime;
      try {
        const bitmap=await createImageBitmap(this.video);
        if(token!==this.generation){bitmap.close();return;}
        this.worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);
      } catch(error) {
        if(token===this.generation)this.fail(error);
        return;
      }
    }
    if(this.pending && now-this.lastSent>5000){this.fail(new Error('手势识别无响应 / Tracking stalled'));return;}
    this.timer=setTimeout(()=>this.tick(token),16);
  }
  getHands(){return performance.now()-this.lastResult<220?this.hands:[];}
  stop() {
    this.generation++;this.active=false;clearTimeout(this.timer);
    this.cancelInit?.();this.cancelInit=null;this.worker?.terminate();this.worker=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    this.video.pause();this.video.srcObject=null;this.pending=false;this.hands=[];
    this.filter.reset();this.lastResult=0;this.lastVideoTime=-1;
  }
}
