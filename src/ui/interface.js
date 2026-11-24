const icons={
  camera:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  sound:'<path d="m11 4-5 4H3v8h3l5 4V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-5 4H3v8h3l5 4V4Z"/><path d="m16 9 5 6m0-6-5 6"/>',
  capture:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1-3h6l1 3"/><circle cx="12" cy="13" r="3.5"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
};
export class Interface {
  constructor(actions) {
    this.actions=actions;this.started=false;this.toastTimer=null;this.quietTimer=null;this.lastState='';
    this.$=id=>document.getElementById(id);
    for(const [id,icon] of [['camera','camera'],['sound','sound'],['capture','capture'],['fullscreen','fullscreen'],['reset','reset']]) this.icon(id+'-button',icon);
    this.$('start-camera').onclick=()=>actions.start('hands');
    this.$('start-mouse').onclick=()=>actions.start('mouse');
    this.$('camera-button').onclick=()=>actions.camera();
    this.$('sound-button').onclick=()=>actions.sound();
    this.$('volume').oninput=e=>actions.volume(+e.target.value);
    this.$('capture-button').onclick=()=>actions.capture();
    this.$('fullscreen-button').onclick=async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else this.toast('此浏览器请使用 Control + ⌘ + F 进入全屏');}catch{this.toast('全屏暂不可用 / Full screen unavailable');}
    };
    this.$('reset-button').onclick=()=>actions.reset();
    this.$('guide-button').onclick=()=>this.guide(true);
    this.$('close-guide').onclick=()=>this.guide(false);
    this.$('guide').addEventListener('click',e=>{if(e.target===this.$('guide')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.guide(false);}});
    this.$('guide').addEventListener('close',()=>this.$('guide-button').setAttribute('aria-expanded','false'));
    this.$('close-preview').onclick=()=>{this.$('preview').hidden=true;};
    this.$('preview-button').onclick=()=>{this.$('preview').hidden=!this.$('preview').hidden;};
    this.$('universe').addEventListener('pointermove',()=>this.awake(),{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.$('preview').hidden=true;});
  }
  icon(id,key){this.$(id).innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;}
  enter(){if(this.started)return;this.started=true;this.$('invitation').classList.add('leaving');setTimeout(()=>this.$('invitation').hidden=true,1100);this.$('experience').hidden=false;this.awake();}
  awake(){document.body.classList.remove('quiet');clearTimeout(this.quietTimer);this.quietTimer=setTimeout(()=>document.body.classList.add('quiet'),12000);}
  guide(open){const g=this.$('guide');if(open&&!g.open)g.showModal();else if(!open&&g.open)g.close();this.$('guide-button').setAttribute('aria-expanded',String(open));}
  toast(text){this.$('toast').textContent=text;this.$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.$('toast').classList.remove('visible'),5000);}
  camera(status,error){
    const busy=['requesting','loading'].includes(status),active=status==='ready';
    this.$('start-camera').disabled=busy;this.$('camera-button').disabled=busy;
    this.$('camera-button').setAttribute('aria-pressed',String(active));
    this.$('camera-button').setAttribute('aria-label',active?'关闭摄像头，切换鼠标 / Camera off':'开启摄像头 / Camera');
    this.$('camera-button').title=active?'关闭摄像头，切换鼠标 / Camera off':'开启摄像头 / Camera';
    this.$('preview-button').hidden=!active;
    if(!active)this.$('preview').hidden=true;
    if(status==='requesting')this.toast('请允许摄像头访问 / Allow camera access');
    if(status==='loading')this.toast('正在唤醒本地手势感知 / Loading local hand tracking…');
    if(active)this.toast('张开手掌，让星尘发现你 / Open a palm to begin');
    if(status==='error')this.toast(error?.name==='NotAllowedError'?'摄像头未授权，已进入鼠标模式 / Mouse mode ready':`摄像头暂不可用，已切换鼠标 / ${error?.message||'Camera unavailable'}`);
  }
  update(s,mode){
    const names={drift:'自由漂流',attraction:'聚灵',collapse:'坍缩',release:'释能',expansion:'拓界',incubation:'生命孕育'};
    const label=mode==='hands'&&s.mode==='incubation'&&!s.birth?'和平手势 · 保持片刻':s.releaseGlow>0?'释能':names[s.mode];
    if(label!==this.lastState){this.$('state-label').textContent=label;this.lastState=label;}
    const modeLabel=mode==='hands'?`双手感知 · ${s.hands}/2`:'鼠标模式';
    if(this.$('mode-label').textContent!==modeLabel)this.$('mode-label').textContent=modeLabel;
    const hint=mode==='hands'?'张掌聚灵 · 握拳坍缩 · 伸出拇指、食指和中指，保持半秒':'移动鼠标聚拢星尘 · 按住积蓄能量 · 双击孕育生命';
    if(this.$('hint').textContent!==hint)this.$('hint').textContent=hint;
  }
  fatal(error){this.$('invitation').hidden=true;this.$('fatal').hidden=false;this.$('fatal-text').textContent=error.message;}
}
