# 第三方依赖与素材

| 组件 | 版本与用途 | 授权 |
| --- | --- | --- |
| Three.js | 0.187.0。WebGL 渲染与后处理 | [MIT](docs/licenses/Three-MIT.txt) |
| MediaPipe Tasks Vision | 1.2.3。手势运行时与匹配 WASM | [Apache 2.0](docs/licenses/MediaPipe-Apache-2.0.txt) |
| MediaPipe Hand Landmarker Full | Float16 v1。掌部检测和手部关键点推理 | [Apache 2.0 模型卡](https://huggingface.co/litert-community/MediaPipe-HandLandmarker-Full) |
| Vite | 8.3.8。开发、构建与本地预览 | [MIT 及附带声明](docs/licenses/Vite-MIT.md) |
| Playwright | 1.65.1。仅用于浏览器测试 | [Apache 2.0](docs/licenses/Playwright-Apache-2.0.txt) |

[Google 模型下载](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) 对应 `public/models/hand_landmarker.task`。SHA-256 为 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`。MediaPipe 的上游授权和模型说明见 [源代码仓库](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) 与 [Hand Landmarker 官方文档](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)。

星云、星尘、蝴蝶、图标和声音均由项目代码生成。字体使用浏览器的系统字体栈。测试使用 MediaPipe 的公开手部照片作为临时输入，该图片不会被项目分发，也不会出现在作品截图中。
