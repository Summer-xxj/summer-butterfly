import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.PALMVERSE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
  const context = await browser.newContext({ viewport: {width: 1440, height: 900} });
  const external = [], requested = new Set(), errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      requested.add(url.pathname);
      return route.continue();
    }
    external.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  assert.match(await page.title(), /Summer’s Universe/);
  const cameraButton = page.locator('#camera-button');
  const realInput = () => page.evaluate(() => Boolean(document.querySelector('#camera-video').srcObject));
  const cameraReady = () => page.waitForFunction(() => document.querySelector('#camera-button').ariaPressed === 'true');
  await page.evaluate(() => {
    const devices = navigator.mediaDevices;
    const open = devices.getUserMedia.bind(devices);
    devices.getUserMedia = () => {
      devices.getUserMedia = open;
      return Promise.reject(new DOMException('Simulated OS camera failure', 'AbortError'));
    };
  });
  await page.locator('#start-camera').click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('摄像头暂不可用'));
  assert.equal(await cameraButton.isEnabled(), true);
  assert.equal(await realInput(), false);

  await cameraButton.click();
  await cameraReady();
  assert.equal(await realInput(), true);
  await page.evaluate(() => {
    const track = document.querySelector('#camera-video').srcObject.getTracks()[0];
    window.fixtureTrack = track;
    track.dispatchEvent(new Event('ended'));
  });
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('摄像头已断开'));
  assert.equal(await realInput(), false);
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended');

  await cameraButton.click();
  await cameraReady();
  await page.waitForTimeout(400);
  await cameraButton.click();
  assert.equal(await realInput(), false);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  for (const path of ['/hand-worker.js','/vendor/vision_bundle.js','/models/hand_landmarker.task','/wasm/vision_wasm_internal.wasm']) {
    assert.ok(requested.has(path), path);
  }
  console.log(JSON.stringify({browser:browser.version(),requests:[...requested],external,errors,recovery:'AbortError → retry → track ended → retry → camera off'}));
} finally {
  await browser.close();
}
