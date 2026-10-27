# Server 本地运行

```bash
cp .env.example .env.local
npm install
npm run dev:all
```

- Web：`http://localhost:3000`
- MQTT：`mqtt://localhost:1883`
- 默认 `AI_MODE=mock`，无需 Key。
- 接阿里百炼时，把 `AI_MODE` 改为 `openai-compatible`，填写 workspace Base URL 和 API Key；默认使用 `qwen-plus` 与 `qwen3-asr-flash`。
- 真实 ASR 处理长录音需要本机安装 `ffmpeg` 和 `ffprobe`；单段自动控制在 290 秒以内。
- 其他服务若提供标准 `/audio/transcriptions`，把 `AI_ASR_PROVIDER` 改为 `openai-transcription`。

`dev:all` 会同时启动 Next.js、后台 Worker 和本地 MQTT Broker。上传 API 返回后，由 Worker 在后台继续处理任务。
