# Nota MVP

这是一个本地可运行的最小演示：Flutter Hardware Simulator 录音并上传，Next.js 创建异步任务，Worker 完成 ASR、文本校准和 Agent 工具调用，MQTT 通知 Flutter 用户端和 Simulator，再由客户端通过 HTTP 获取最终结果。

## 目录

```text
nota-mvp/
├── apps/server/               # Next.js Web、API、Worker、MQTT Broker
├── apps/mobile/               # Flutter 用户 App
├── apps/hardware_simulator/   # Flutter 硬件模拟器
└── docs/                      # 需求、架构图、时序图、演示脚本
```

## 本机依赖

- Node.js、npm
- Flutter 3.29 或兼容版本（运行 App 时需要）
- FFmpeg 与 FFprobe（录音超过 5 分钟或 8MB 时自动压缩、分片）

## 先运行服务端

```bash
cd apps/server
npm install
cp .env.example .env.local     # 本地已经配置过时不要覆盖
npm run dev:all
```

- Web：`http://localhost:3000`
- MQTT：`mqtt://localhost:1883`
- `dev:all` 会同时启动 Next.js、后台 Worker 和 MQTT Broker。

模型配置集中在 `apps/server/src/config/ai.ts`，实际值由 `apps/server/.env.local` 提供：

```dotenv
AI_MODE=mock
AI_BASE_URL=https://YOUR_WORKSPACE.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
AI_API_KEY=
AI_CHAT_MODEL=qwen-plus
AI_ASR_PROVIDER=alibaba-chat
AI_ASR_MODEL=qwen3-asr-flash
ASR_MAX_BYTES=8388608
ASR_MAX_SECONDS=290
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

`mock` 模式不需要 Key；切换到 `openai-compatible` 后使用真实 ASR 和 Chat Model。`.env.local` 已加入 Git 忽略，不能提交真实 Key。

## 运行 Flutter App

两个 Flutter 工程已经包含 Android/iOS 平台壳。安装 Flutter SDK 后分别执行：

```bash
cd apps/mobile
flutter pub get

cd ../hardware_simulator
flutter pub get
```

Android 模拟器访问电脑服务使用 `10.0.2.2`：

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=MQTT_HOST=10.0.2.2
```

iOS 模拟器可使用 `127.0.0.1`；真机需要换成电脑的局域网 IP。Simulator 还支持 `TRANSCRIPT_HINT`，只在服务端 Mock 模式下用于无 Key 演示。

## 演示流程

1. 启动 `npm run dev:all` 并打开 Web。
2. 用 Hardware Simulator 录制一句包含待办和提醒的语音。
3. Simulator 上传后立即得到 `taskId`，MQTT 持续展示处理阶段。
4. Web 或 Flutter 用户端展示 ASR 原文、校准文本、摘要及 Agent 工具调用。
5. 在“查询历史记录”中提问，查看 `searchHistory` 的输入、结果和回答。
6. 展示今日额度；成功任务扣一次，失败任务释放，重复 `requestId` 不重复扣。

## 架构与关键取舍（300字以内）

Next.js 同时承载网页和 API，SQLite 保存任务、结果与每日额度；独立 Worker 轮询待处理任务，线性执行音频压缩、ASR、文字校准、Agent 和结果验证。录音上传后 HTTP 立即返回，MQTT 只发布阶段通知，客户端始终通过 HTTP 获取权威结果。模型通过统一配置切换 Mock 或阿里云兼容接口。第一版只实现 happy path，失败即释放额度并提示重新开始，不引入 Redis、云存储、向量库、复杂重试和历史回填。

## 验证

```bash
cd apps/server
npm test
npm run build

cd ../mobile
flutter analyze
flutter build apk --debug

cd ../hardware_simulator
flutter analyze
flutter build apk --debug
```

服务端已覆盖额度幂等、失败释放和 Mock 流水线测试；两个 Flutter 工程均已通过 `flutter analyze`。使用一段 36 分钟、18MB 的 M4A 做过真实测试，系统自动切为 8 段并完成 ASR、校准、摘要和额度核销。测试数据已从交付目录清除。Hardware Simulator 的 Android/iOS 麦克风权限及本地 HTTP/MQTT 访问权限已经写入平台配置。

本地交付目录已构建 `artifacts/nota-mobile-debug.apk` 和 `artifacts/nota-hardware-simulator-debug.apk`，可以直接安装演示。APK 属于本地构建产物，不提交到 GitHub；通过上面的命令可从源码重新生成。

## 文档

- [需求说明](docs/REQUIREMENTS.md)
- [架构说明与架构图](docs/ARCHITECTURE.md)
- [端到端时序图](docs/SEQUENCE.md)
- [三分钟演示脚本](docs/DEMO_SCRIPT.md)

