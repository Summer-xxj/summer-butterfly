import { mkdir, copyFile } from 'node:fs/promises';
const source = 'node_modules/@mediapipe/tasks-vision';
await mkdir('public/wasm', { recursive: true });
await mkdir('public/vendor', { recursive: true });
for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  await copyFile(`${source}/wasm/${file}`, `public/wasm/${file}`);
}
await copyFile(`${source}/vision_bundle.js`, 'public/vendor/vision_bundle.js');
console.log('Local MediaPipe runtime copied.');
