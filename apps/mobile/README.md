# Nota Flutter 用户端

这个 App 只负责查看任务、额度与 AI 结果。HTTP 是权威数据来源，MQTT 仅在任务阶段变化时触发一次 HTTP 刷新。

## 目录

- `models/`：API 数据模型。
- `services/`：HTTP 与 MQTT 客户端。
- `state/`：一个轻量 `ChangeNotifier` 状态容器。
- `screens/`：任务列表和任务详情。
- `widgets/`：额度、阶段、结果和工具调用组件。

## 安装依赖

工程已包含 Android/iOS 平台壳，在本目录执行：

```bash
flutter pub get
```

## 运行

iOS Simulator 可以直接访问本机 `127.0.0.1`：

```bash
flutter run
```

Android Emulator 访问宿主机需要使用 `10.0.2.2`：

```bash
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000 \
  --dart-define=MQTT_HOST=10.0.2.2 \
  --dart-define=MQTT_PORT=1883
```

真机运行时，把两个地址改为电脑在同一局域网中的 IP。开发环境使用明文 HTTP/MQTT；如果平台壳限制明文流量，只在 Debug 配置中放开。

## 行为

1. 启动时请求 `/api/tasks` 与 `/api/quota`。
2. 订阅 `nota/tasks/+/status`。
3. 收到 MQTT 消息后按 `taskId` 调用 HTTP 获取最新结果。
4. App 回到前台或用户下拉刷新时重新同步，避免依赖后台长连接。
