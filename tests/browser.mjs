import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { peaceFrame } from './fixtures/peace-hand.js';

const origin='http://127.0.0.1:5173';
const chrome=await chromium.launch({channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const view={width:1440,height:1000};
const load = page => page.goto(origin);
const wait = (page,predicate) => page.waitForFunction(predicate,undefined,{timeout:12000});
const shot = (page,name) => page.screenshot({path:'docs/screenshots/'+name+'.png'});
function watch(page) {
  const issues=[];
  page.on('pageerror',error=>issues.push(error.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Created TensorFlow Lite XNNPACK delegate'))issues.push(m.text());});
  return issues;
}
async function state(page,fn){
  return page.evaluate(async code=>{
    const {app}=await import(document.querySelector('script[src*="/src/core/main.js"]').src);
    return Function('app','return ('+code+')(app)')(app);
  },String(fn));
}
try {
  const context=await chrome.newContext({viewport:view,acceptDownloads:true});
  let externalRequests=0;
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){externalRequests++;return route.abort();}return route.continue();});
  const page=await context.newPage(),issues=watch(page);
  await load(page);
  assert.equal(await page.title(),'Summer’s Universe · Summer 的宇宙');
  await wait(page,async()=>{const {app}=await import(document.querySelector('script[src*="/src/core/main.js"]').src);
    if(!app.running)throw Error(document.querySelector('#fatal-text').textContent);
    return app.frames>20;});
  await page.waitForTimeout(300);
  assert.match(await page.locator('h1').innerText(),/Summer’s\s+Universe/);
  await shot(page,'01-initial');
  await page.locator('#guide-button').click();
  assert.equal(await page.locator('#guide').isVisible(),true);
  assert.match(await page.locator('#guide').innerText(),/拇指、食指和中指/);
  await shot(page,'09-guide');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#guide').isVisible(),false);
  await page.locator('#start-mouse').click();
  await page.locator('#invitation').waitFor({state:'hidden'});
  await page.mouse.move(860,390);
  await page.waitForTimeout(1700);
  assert.ok(await state(page,a=>a.state.influence)>.85);
  await shot(page,'02-attraction');
  await page.mouse.down();
  await page.waitForTimeout(2400);
  assert.ok(await state(page,a=>a.state.collapse)>.8);
  await shot(page,'03-collapse');
  await page.mouse.up();
  await page.waitForTimeout(390);
  assert.equal(await state(page,a=>a.metrics.releases),1);
  await shot(page,'04-release');

  // The browser renders expansion and the three-finger sign with simulated
  // normalized hand observations. Camera lifecycle is tested separately below.
  await state(page,a=>{
    a.reset();
    a.input.setMode('hands');
    window.testHands=[];
    window.setHands=(x,y=.13)=>{
      window.testHands=[{id:'Left',x:-x,y,openness:1,confidence:.98},{id:'Right',x,y,openness:1,confidence:.98}];
    };
    a.camera.getHands=()=>window.testHands;
    window.setHands(.66);
  });
  await page.waitForTimeout(2450);
  assert.ok(await state(page,a=>a.state.scale)>1.6);
  await shot(page,'05-expansion');
  await page.evaluate(frame=>{window.peaceFrame=frame;},peaceFrame());
  await state(page,a=>{
    let last=0, hands=[];
    a.camera.filter.reset();
    a.camera.getHands=()=>{
      const now=performance.now();
      if(now-last>=40){
        last=now;
        hands=a.camera.filter.process(window.peaceFrame,now);
      }
      return hands;
    };
  });
  await wait(page,()=>document.querySelector('#state-label').textContent.includes('保持片刻'));
  await shot(page,'06-incubation');
  await wait(page,()=>document.querySelector('#toast').textContent.includes('新的生命'));
  await page.waitForTimeout(1750);
  assert.equal(await state(page,a=>a.life.creatures.length),1);
  await shot(page,'07-emergence');
  await state(page,a=>{a.camera.getHands=()=>[];});
  await page.waitForTimeout(4550);
  assert.ok(await state(page,a=>a.life.creatures[0].reveal)>.99);
  await shot(page,'08-free-flight');
  await state(page,a=>{delete a.camera.getHands;delete window.setHands;delete window.testHands;delete window.peaceFrame;a.input.setMode('mouse');});
  await page.locator('#sound-button').click();
  assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'),'true');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#capture-button').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^PALMVERSE_\d{8}_\d{6}\.png$/);
  const png=await readFile(await download.path());
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[2880,2000]);
  await download.saveAs('docs/screenshots/10-export.png');
  await page.locator('#fullscreen-button').click();
  await wait(page,()=>document.fullscreenElement!==null);
  await page.locator('#fullscreen-button').click();
  await wait(page,()=>document.fullscreenElement===null);
  await page.locator('#reset-button').click();
  assert.equal(await state(page,a=>a.life.creatures.length),0);

  await page.locator('#camera-button').click();
  await wait(page,()=>document.querySelector('#camera-button').getAttribute('aria-pressed')==='true');
  await page.waitForTimeout(1100);
  const inference=await state(page,a=>({ms:a.camera.inferenceMs,frame:a.camera.lastResult>0}));
  assert.ok(inference.frame&&inference.ms>0);
  await state(page,a=>{window.testTrack=a.camera.stream.getVideoTracks()[0];});
  await page.locator('#preview-button').click();
  assert.equal(await page.locator('#preview').isVisible(),true);
  await page.locator('#camera-button').click();
  assert.deepEqual(await state(page,a=>[a.camera.stream,a.camera.worker,window.testTrack.readyState,a.input.mode]),[null,null,'ended','mouse']);
  assert.equal(await page.locator('#preview').isVisible(),false);
  assert.equal(externalRequests,0);
  assert.deepEqual(issues,[]);
  console.log(JSON.stringify({chrome:chrome.version(),viewport:view,inference,externalRequests,issues,png:[2880,2000]}));

  const mobile=await chrome.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobileIssues=watch(mobile);
  await load(mobile);
  assert.ok(await mobile.locator('#start-camera').isVisible());
  await mobile.waitForTimeout(500);
  await shot(mobile,'11-mobile');
  assert.deepEqual(mobileIssues,[]);
  await mobile.close();

} finally {await chrome.close();}

const permissionBrowser=await chromium.launch({channel:'chrome',args:['--use-fake-device-for-media-stream']});
try {
  const denied=await permissionBrowser.newPage();
  const cdp=await denied.context().newCDPSession(denied);
  const {targetInfo}=await cdp.send('Target.getTargetInfo');
  await cdp.send('Browser.setPermission',{permission:{name:'camera'},setting:'denied',origin,browserContextId:targetInfo.browserContextId});
  await load(denied);
  assert.equal(await denied.evaluate(async()=>(await navigator.permissions.query({name:'camera'})).state),'denied');
  await denied.locator('#start-camera').click();
  await wait(denied,()=>document.querySelector('#toast').textContent.includes('摄像头未授权'));
  assert.deepEqual(await state(denied,a=>[a.input.mode,a.camera.active]),['mouse',false]);
  console.log('Chrome: camera permission denied, mouse fallback confirmed');
}finally{await permissionBrowser.close();}

const safari=await webkit.launch();
try{
  const page=await safari.newPage({viewport:{width:1280,height:900}});
  const issues=watch(page);
  await load(page);
  await page.locator('#start-mouse').click();
  await page.locator('#invitation').waitFor({state:'hidden'});
  await wait(page,async()=>{
    const {app}=await import(document.querySelector('script[src*="/src/core/main.js"]').src);
    return app.frames>20;
  });
  await page.locator('#guide-button').click();
  assert.equal(await page.locator('#guide').isVisible(),true);
  await page.locator('#close-guide').click();
  await shot(page,'12-webkit');
  assert.deepEqual(issues,[]);
  console.log(JSON.stringify({webkit:safari.version(),issues}));
}finally{await safari.close();}
