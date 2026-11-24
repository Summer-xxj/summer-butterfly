/* Classic worker: local IIFE runtime intentionally avoids remote module imports. */
importScripts('/vendor/vision_bundle.js');
let detector=null;
self.onmessage=async({data})=>{
  try {
    if(data.type==='init') {
      const files=await Vision.FilesetResolver.forVisionTasks('/wasm');
      detector=await Vision.HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},
        runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,
        minHandPresenceConfidence:.6,minTrackingConfidence:.6,
      });
      postMessage({type:'ready'});
    } else if(data.type==='frame' && detector) {
      const start=performance.now();
      try {
        const result=detector.detectForVideo(data.bitmap,data.timestamp);
        postMessage({type:'result',landmarks:result.landmarks,handedness:result.handedness,
          timestamp:data.timestamp,inferenceMs:performance.now()-start});
      } finally {data.bitmap.close();}
    }
  } catch(error) {data.bitmap?.close();postMessage({type:'error',message:error.message||String(error)});}
};
