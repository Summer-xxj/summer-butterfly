import { clamp } from '../themes/celestial.js';
export class Soundscape {
  constructor() {this.context=null;this.muted=false;this.volume=.32;this.voices=new Set();}
  async start() {
    if(!this.context) {
      const Context=window.AudioContext||window.webkitAudioContext;
      this.context=new Context();const c=this.context;
      this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
      this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=540;
      this.filter.Q.value=.4;this.filter.connect(this.master);
      this.ambient=c.createGain();this.ambient.gain.value=.035;this.ambient.connect(this.filter);
      this.oscillators=[55,82.41,110.12,164.81].map((f,i)=>{
        const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.value=i===0?.5:.18;
        o.connect(g);g.connect(this.ambient);o.start();return o;
      });
    }
    await this.context.resume();this.applyVolume();
  }
  applyVolume(){if(this.context)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.55,this.context.currentTime,.2);}
  setVolume(v){this.volume=clamp(v);this.applyVolume();}
  toggle(){this.muted=!this.muted;this.applyVolume();return this.muted;}
  update(s){if(!this.context)return;const t=this.context.currentTime;this.filter.frequency.setTargetAtTime(380+s.energy*200+s.influence*120+s.incubation*330,t,.3);this.oscillators[0].frequency.setTargetAtTime(55-s.energy*13,t,.25);}
  tone(kind,power=.5) {
    if(!this.context || this.voices.size>=6)return;
    const c=this.context,t=c.currentTime,duration=kind==='birth'?3.6:1.8;
    const o=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();
    o.type='sine';o.frequency.setValueAtTime(kind==='birth'?523.25:150,t);
    o.frequency.exponentialRampToValueAtTime(kind==='birth'?783.99:45,t+duration);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime((kind==='birth'?.055:.07)*power,t+.15);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    pan.pan.value=(Math.random()-.5)*.65;o.connect(gain);gain.connect(pan);pan.connect(this.master);
    const voice={o,gain,pan};this.voices.add(voice);o.onended=()=>{o.disconnect();gain.disconnect();pan.disconnect();this.voices.delete(voice);};
    o.start(t);o.stop(t+duration+.05);
  }
  reset(){for(const v of this.voices){v.o.onended=null;try{v.o.stop();}catch{}v.o.disconnect();v.gain.disconnect();v.pan.disconnect();}this.voices.clear();}
  suspend(){return this.context?.suspend();}
  resume(){if(this.context)return this.context.resume();}
  dispose(){this.reset();this.oscillators?.forEach(o=>o.stop());this.context?.close();}
}
