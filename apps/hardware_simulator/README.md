# Nota Hardware Simulator

一个最小 Flutter App，用手机麦克风模拟 Nota 硬件：录音、HTTP 上传、订阅 MQTT 任务状态并显示最终摘要。

## 安装依赖

工程已包含 Android/iOS 平台壳。安装 Flutter SDK 后，在当前目录执行：

```bash
flutter pub get
```

## 本地运行

先启动根目录 README 中的 Next.js、Worker 和 MQTT Broker，再运行：

```bash
# Android Emulator 访问宿主机
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=MQTT_HOST=10.0.2.2 \
  --dart-define=MQTT_PORT=1883

# iOS Simulator 通常可改为 http://localhost:3000 和 localhost
```

Mock 模式会把 `TRANSCRIPT_HINT` 随音频一起上传，方便在没有模型 Key 时跑完整流程：

```bash
flutter run --dart-define=TRANSCRIPT_HINT="明天下午三点准备演示，并提前一小时提醒我"
```

## 平台权限

以下权限已经写入工程，无需手工补充：

Android `android/app/src/main/AndroidManifest.xml`：

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

本地 HTTP 演示还需要在 `<application>` 上设置：

```xml
android:usesCleartextTraffic="true"
```

iOS `ios/Runner/Info.plist`：

```xml
<key>NSMicrophoneUsageDescription</key>
<string>用于录制并上传 Nota 演示音频</string>
<key>NSLocalNetworkUsageDescription</key>
<string>用于连接本机 Nota API 和 MQTT Broker</string>
```

如果 iOS 阻止本地 HTTP，请仅在本地演示配置中增加 App Transport Security 例外；正式环境应使用 HTTPS。

## Happy Path

1. 点击“开始录音”。
2. 点击“停止并上传”。
3. 服务端返回 `taskId`，App 订阅 `nota/tasks/{taskId}/status`。
4. `COMPLETED` 或 `FAILED` 后，通过 HTTP 获取最终结果。
5. 失败时点击“重新开始”，不实现复杂断点恢复。
