# PALMVERSE V1.0 测试报告

2026-11-24，MacBook Air，Apple M5 / 24 GB，macOS 26.6.2。

| 验证 | 结果 |
| --- | --- |
| 逻辑与资源 | 18 项通过。覆盖引力和能量状态、快慢释能、三指和平手势、双手拓界、稳定的手身份、15 分钟模拟粒子、蝴蝶上限和资源清理。 |
| Chrome 157.0.8103.79 | 1440×1000 与 390×844。检查开场、指南、鼠标聚散与模拟三指关键点触发破茧与飞行、静音、全屏、重启、摄像头开关和拒绝授权。最终导出 PNG 为 2880×2000。 |
| Safari 与 WebKit | 本机 Safari 显示生产画面并进入鼠标模式。Playwright WebKit 27.2 验证渲染、鼠标入口和指南。两个浏览器引擎均能初始化本地模型。 |
| 模型实测 | MediaPipe 的公开双手照片在 Chrome、WebKit 中均得到 2×21 关键点，生产过滤器均保留两掌。该照片的首帧推理约 85–91 ms（Chrome）和 70–76 ms（WebKit）。Chrome 的生成摄像流在一次稳态采样中约 25 ms，测量范围仅为 Worker 推理。 |
| 生产构建与离线 | Mac 启动脚本打开 Chrome。干净浏览器会话拦截全部非环回网络后，生产页面及 Worker、WASM、模型均从本机加载，外部请求数为 0。模拟 OS 摄像头错误和媒体轨道断开后均可重新启用。 |
| 连续运行 | Chrome 在 1440×900 下运行 900.01 秒。鼠标模式持续渲染，每分钟多次交互并定期重启，共 54,009 个 rAF 帧，平均 60.0 FPS、超过 50 ms 的帧间隔 0 次、页面错误 0。预热后每分钟强制 GC 再采样，JS 堆 4.46–5.26 MiB，末次 4.64 MiB。长测使用候选生产构建，最终构建另做浏览器回归。[原始采样](docs/endurance.json) |

### 实际渲染证据

| 场景 | 输入和截图 |
| --- | --- |
| 初始宇宙 | 无输入，[初生](docs/screenshots/01-initial.png) |
| 星尘聚集 | 鼠标移动，[聚灵](docs/screenshots/02-attraction.png) |
| 能量坍缩 | 鼠标长按，[坍缩](docs/screenshots/03-collapse.png) |
| 能量释放 | 鼠标松开，[释能](docs/screenshots/04-release.png) |
| 双手拓界 | 模拟双掌，[拓界](docs/screenshots/05-expansion.png) |
| 蝴蝶孕育 | 模拟单手三指姿势，[光茧](docs/screenshots/06-incubation.png) |
| 蝴蝶破茧 | 模拟单手三指姿势保持约半秒，[破茧](docs/screenshots/07-emergence.png) |
| 蝴蝶自由飞行 | 模拟手离开后自主飞行，[自由](docs/screenshots/08-free-flight.png) |

另附 [指南](docs/screenshots/09-guide.png)、[纯画面导出](docs/screenshots/10-export.png)、[窄屏](docs/screenshots/11-mobile.png)、[WebKit](docs/screenshots/12-webkit.png)。本地照片推理、模拟手势驱动的三维渲染和真实摄像头体验分别记录。

### 体验审查

- 数字艺术。依截图修正后处理背景亮度，压低轨道线，保留局部光晕。收窄释能波前的亮度与范围，使用破碎轮廓。蝶翼轮廓和银金色纹理能与星云区分。
- 交互。按测试修复瞬间握拳误释能、双手排序变化导致的位置跳变，以及窄屏标题和星系的重叠。手掌离开后引力衰减，蝴蝶保持飞行。
- 工程。粒子批量绘制，Worker 单帧推理。实测授权拒绝、设备断开、重新启用、关闭摄像头、重启和导出。Vite 对包含 Three.js 的约 620 kB 本地 JS 包给出尺寸提醒，构建成功。

### 待做的人机测试

实机摄像头的双手连续手势、左右与遮挡、弱光、从动作到画面的端到端延迟、扬声器听感，以及 Safari 的摄像头授权由使用者按 [实机清单](docs/GESTURE_GUIDE.md) 验证。真实相机与高负载下的帧率、GPU 内存和完整进程内存尚未量测。网络测试保留环回连接并阻止外部请求。

复现用 `npm test`、`npm run build`。启动 `npm run dev` 后用 `npm run test:browser`，启动生产预览后用 `node tests/production.mjs`。模型测试用 `node tests/camera-probe.mjs /path/to/right_hands.jpg`，图片取自 [MediaPipe 公开测试素材](https://storage.googleapis.com/mediapipe-assets/right_hands.jpg)。
