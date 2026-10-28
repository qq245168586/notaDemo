# Nota MVP

这是一个本地可运行的最小演示：Flutter Hardware Simulator 录音并上传，Next.js 创建异步任务，Worker 完成 ASR、文本校准和 Agent 工具调用，MQTT 通知 Flutter 用户端和 Simulator，再由客户端通过 HTTP 获取最终结果。

本地测试只有一个默认账号，无需注册、登录、绑定设备或填写 MQTT 用户名密码；网页和两个 App 共用记录与每轮 10 次额度，用完后自动开始下一轮。MQTT 使用 3.1.1，通知连接失败时 App 仍通过 HTTP 定时查询任务结果，不会把已上传的任务误报为失败。iOS 模拟器默认连接本机 `127.0.0.1`。

## 实时处理与 iOS 系统提醒

转写结果中的时间会显示为蓝色下划线。点击后直接打开系统提醒/日历确认窗，自动预填时间和上下文事项；相对日期以录音创建日期为基准，时区由 `NOTA_TIMEZONE` 决定。完整时间自动解析，缺少日期、具体时刻或上午/下午则要求补选。结合邻近“下午”等词推定的时间会明确注明依据。标题从附近原文事项中提取，不让模型用时间词充当事项标题。

时间提取还会调用模型结合整句识别同一事项中分散的日期、时段、时刻和动作，提示词在 `apps/server/src/server/semantic-time.ts`。例如“今晚我想在大概九点钟的时候去一趟龙岗”预填录音当天 21:00，“明天上午”仍要求补充时刻。模型只返回原文词及证据片段，服务端验证原文引用并计算日期，拒绝补造时间；接口失败时回退规则解析。此处理不改变转写内容。

在转写与摘要之间加入文本可信度复核。详情展示实际删改、疑词候选、简短依据及局限；不展示模型内部思维链，不把文本复核伪装成声学置信分数。对删改强制保留“待核对原音”的提示，避免模型仅因通顺就判为正确。`AI_VOCABULARY` 可配置用户专名候选（如祖安）；词库只辅助识别与回听比对，不强制替换。旧录音在打开详情时按需补充本条说明，不重跑 ASR，也不重复扣额度。

硬件上传后，用户端会自动出现任务。列表和详情展示音频准备、ASR、校准、Agent 和核验阶段；ASR、校准、摘要使用模型真实 SSE 输出，每 200ms 最多保存和通知一次增量，断线后可通过 HTTP 恢复当前文字与处理记录。兼容的阿里 ASR 支持流式；`openai-transcription` 适配器仍按音频分片完成后展示结果，不模拟逐字输出。极短录音也可能一次返回全部识别内容。

已完成任务的详情页提供“系统日历”和“提醒事项”。用户确认标题、日期、时间和提前量后，由 Flutter MethodChannel 调用独立的 Swift `CalendarBridge`，使用 EventKit 保存到 iOS。时间不明确时必须由用户选择；取消不写入，拒绝权限会显示提示，同一事项和时间重复保存不会新增。日历事件默认 1 小时；可准时提醒或提前 10 分钟、1 小时、1 天。只有用户确认保存后才算写入系统，服务端 Agent 生成的是提醒草稿。

验证命令：

```bash
cd apps/server
npm test
npx tsx scripts/verify-live.ts /path/to/short-audio.m4a # 使用真实模型，成功后消耗一次演示额度

cd ../mobile
flutter test
# iOS 原生测试需先在测试模拟器给 App 授予日历和提醒事项权限
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,id=YOUR_DEVICE_ID' -parallel-testing-enabled NO test
```

实现依据：[阿里 ASR 流式接口](https://help.aliyun.com/en/model-studio/qwen-asr-api-reference)、[模型 SSE 输出](https://help.aliyun.com/en/model-studio/stream)、[Apple EventKit 权限与保存](https://developer.apple.com/documentation/eventkit/accessing-calendar-using-eventkit-and-eventkitui)。

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
- MongoDB 8.0 单节点副本集（安装方式见下方）
- Flutter 3.29 或兼容版本（运行 App 时需要）
- FFmpeg 与 FFprobe（录音超过 5 分钟或 8MB 时自动压缩、分片）

## 先运行服务端

```bash
cd apps/server
npm install
cp .env.example .env.local     # 本地已经配置过时不要覆盖
npm run mongo:start
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
6. 展示本轮额度；成功任务扣一次，失败任务释放，重复 `requestId` 不重复扣；完成 10 次自动重新计数。

## 架构与关键取舍（300字以内）

Next.js 承载网页和 API，MongoDB 保存任务、处理记录、校验结果和额度；独立 Worker 执行音频处理、ASR、校准、Agent 和结果验证。上传后立即返回任务 ID，MQTT 通知刷新，HTTP 获取权威结果。MongoDB 单节点副本集提供事务，保护额度预占、结算和重复请求。历史原文分块生成 embedding，存入 MongoDB，由 Node 计算余弦相似度，提供带来源的历史参考。当前按用户演示要求，每轮成功 10 次自动重新计数，不再是题目原始的每日硬上限。

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


## MongoDB 本地运行与迁移

安装 MongoDB 8.0（Apple Silicon macOS）：

```bash
brew tap mongodb/brew
brew install mongodb-community@8.0 --without-mongodb-database-tools --without-mongosh
cd apps/server
npm install
npm run mongo:start
npm run dev:all
```

`mongo:start` 只监听 `127.0.0.1:27017`，数据目录是 `apps/server/data/mongodb`，使用单节点副本集 `nota-rs` 支持事务。无需另装 PostgreSQL / pgvector，也不需要 Atlas。

- 配置：`apps/server/.env.local` 中的 `MONGODB_URI`、`MONGODB_DATABASE`、`AI_EMBEDDING_MODEL`。模型 Key 沿用现有服务端配置，不会发送给 App。
- 迁移：先停旧服务，再执行 `npm run db:migrate`。脚本保存一致性 SQLite 备份，迁移全部任务、结果、处理步骤、校验说明、删除标记和额度，逐字段核对。目标库非空会拒绝覆盖。报告在 `data/mongo-migration-report.json`。
- 音频仍是原有本地文件，MongoDB 保存文件路径。
- `npm run history:index` 为已完成录音建立真实 embedding；新任务完成后自动索引。失败不影响转写，可重复执行命令补充索引。
- 当前是 MongoDB 存向量 + Node 精确余弦计算，适合小数据本地演示，不是原生 ANN / `$vectorSearch`。数据量增加后可部署 mongot 或使用 Atlas。
- 相似度用于寻找历史原文，不是 ASR 可信度。历史参考可能识别错，不允许据此补事实，校准保留原文对照和来源。
- App 左滑只展开红色“删除”按钮，点击按钮后才删除；右滑可以收起。删除为软删除：列表、详情和历史检索不再显示，后台保留处理、结算记录及音频。进行中的任务继续结算，不删除已保存到系统日历的事项。
- 额度统一每轮 10 次，成功结算满 10 次且无预占时自动归零；失败释放预占，重复请求不重复扣费。没有单独的测试模式。
- `npm test` 需要 MongoDB 运行，自动创建并清理随机 `nota_test_*` 数据库，仅操作测试数据。

SQLite 备份和 `src/server/legacy-sqlite-store.ts` 仅用于迁移核对，运行时统一使用 MongoDB。备份不包含迁移后新增任务，回滚前需先停服务并导出 MongoDB 新数据。
