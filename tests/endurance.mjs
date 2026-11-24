import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const url=process.env.PALMVERSE_URL || 'http://127.0.0.1:5173/';
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.getByRole('button',{name:/先用鼠标探索/}).click();
  await page.evaluate(()=>{
    window.palmverseProbe={n:0,last:0,stalls:0};
    const sample=t=>{
      const p=window.palmverseProbe;
      if(p.last && t-p.last>50)p.stalls++;
      p.n++;p.last=t;requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const cdp=await page.context().newCDPSession(page);
  const samples=[],start=Date.now();
  for(let minute=0;minute<=15;minute++){
    if(minute)await page.waitForTimeout(Math.max(0,start+minute*60000-Date.now()));
    await cdp.send('HeapProfiler.collectGarbage');
    const [frames,heap]=await Promise.all([page.evaluate(()=>window.palmverseProbe),cdp.send('Runtime.getHeapUsage')]);
    const item={sec:(Date.now()-start)/1000,frames:frames.n,stalls:frames.stalls,usedMiB:Math.round(heap.usedSize/10485.76)/100};
    samples.push(item);
    console.log(JSON.stringify(item));
    if(minute<15){
      await page.mouse.move(960,330);
      await page.mouse.down();await page.waitForTimeout(1400);await page.mouse.up();
      await page.mouse.dblclick(900,330);
      if(minute%3===2)await page.locator('#reset-button').click();
    }
  }
  assert.deepEqual(errors,[]);
  assert.ok(samples.at(-1).frames>samples[0].frames+27000);
  const report={browser:browser.version(),viewport:[1440,900],samples,errors};
  await writeFile('docs/endurance.json',JSON.stringify(report,null,2)+'\n');
} finally {await browser.close();}
