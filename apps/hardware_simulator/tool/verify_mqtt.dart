// 先启动 npm run dev:all，再运行 dart run tool/verify_mqtt.dart。
// 使用真实 App 的 MQTT 连接代码，只发诊断消息，不创建任务或消耗额度。
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'package:nota_hardware_simulator/services/mqtt_task_service.dart';
// 跨工程验证两个 App 的真实连接代码。
// ignore: avoid_relative_lib_imports
import '../../mobile/lib/services/mqtt_service.dart';

Future<void> main() async {
  final hardware = MqttTaskService(host: '127.0.0.1', port: 1883);
  final mobile = MqttService(host: '127.0.0.1', port: 1883);
  final publisher = MqttServerClient.withPort('127.0.0.1', 'nota-test', 1883)
    ..setProtocolV311();
  final taskId = 'connection-check-${DateTime.now().millisecondsSinceEpoch}';
  final hardwareEvent = Completer<void>();
  final mobileEvent = Completer<void>();
  final subscription = mobile.events.listen((event) {
    if (event.taskId == taskId && !mobileEvent.isCompleted) {
      mobileEvent.complete();
    }
  });
  try {
    await hardware.subscribe(
        taskId: taskId,
        onEvent: (_) {
          if (!hardwareEvent.isCompleted) hardwareEvent.complete();
        });
    await mobile.connect();
    await publisher.connect();
    // QoS1 重发直到两个客户端均订阅成功。
    final timer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      final payload = MqttClientPayloadBuilder()
        ..addString(jsonEncode({'taskId': taskId, 'stage': 'COMPLETED'}));
      publisher.publishMessage(
        'nota/tasks/$taskId/status',
        MqttQos.atLeastOnce,
        payload.payload!,
      );
    });
    try {
      await Future.wait([hardwareEvent.future, mobileEvent.future])
          .timeout(const Duration(seconds: 5));
      stdout.writeln('PASS: 两个App均完成MQTT握手、订阅、接收状态消息');
    } finally {
      timer.cancel();
    }
  } finally {
    await subscription.cancel();
    await hardware.disconnect();
    await mobile.dispose();
    publisher.disconnect();
  }
}
