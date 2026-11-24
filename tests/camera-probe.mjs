import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const fixture=process.argv[2]?(await readFile(process.argv[2])).toString('base64'):null;
for (const engine of [chromium,webkit]) {
 const browser=await engine.launch(engine===chromium?{channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}:{});
 try {
  const page=await browser.newPage();
  page.on('pageerror',e=>console.log('page-error',e.message));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.type(),m.text().slice(0,300));});
  await page.goto('http://127.0.0.1:5173/');
  const result=await page.evaluate(async fixture=>{
   const worker=new Worker('/hand-worker.js'), start=performance.now();
   try {
    const wait=()=>new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=reject;setTimeout(()=>reject(new Error('Worker timeout')),12000);});
    const ready=wait();worker.postMessage({type:'init'});const status=await ready;
    if(status.type!=='ready')return status;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    canvas.getContext('2d').fillRect(0,0,640,480);
    const input=fixture?await (await fetch('data:image/jpeg;base64,'+fixture)).blob():canvas;
    const bitmap=await createImageBitmap(input), next=wait();
    worker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);
    return {...await next,totalMs:Math.round(performance.now()-start)};
   }finally{worker.terminate();}
  },fixture);
  assert.equal(result.type,'result');
  if(fixture){assert.equal(result.landmarks.length,2);assert.ok(result.landmarks.every(hand=>hand.length===21));}
  else assert.equal(result.landmarks.length,0);
  const filtered=await page.evaluate(async result=>{
    const { HandFilter }=await import('/src/perception/filter.js');
    const filter=new HandFilter();
    return filter.process(result,result.timestamp).map(h=>({x:h.x,openness:h.openness,confidence:h.confidence}));
  },result);
  if(fixture)assert.equal(filtered.length,2);
  console.log(engine.name(),JSON.stringify({filtered,hands:result.landmarks.length,landmarks:result.landmarks.map(l=>l.length),inferenceMs:Math.round(result.inferenceMs),totalMs:result.totalMs}));
 }finally{await browser.close();}
}
