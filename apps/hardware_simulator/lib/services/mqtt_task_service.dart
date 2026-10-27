import 'dart:async';
import 'dart:convert';

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

import '../models/task_models.dart';

class MqttTaskService {
  MqttTaskService({required this.host, required this.port});

  final String host;
  final int port;
  MqttServerClient? _client;
  StreamSubscription<List<MqttReceivedMessage<MqttMessage>>>? _subscription;

  Future<void> subscribe({
    required String taskId,
    required void Function(TaskStatusEvent event) onEvent,
  }) async {
    await disconnect();
    final clientId = 'nota-simulator-${DateTime.now().millisecondsSinceEpoch}';
    final client = MqttServerClient.withPort(host, clientId, port)
      ..keepAlivePeriod = 20
      ..autoReconnect = true
      ..logging(on: false)
      ..connectionMessage = MqttConnectMessage()
          .withClientIdentifier(clientId)
          .startClean()
          .withWillQos(MqttQos.atLeastOnce);

    await client.connect();
    if (client.connectionStatus?.state != MqttConnectionState.connected) {
      client.disconnect();
      throw StateError('MQTT连接失败');
    }

    final topic = 'nota/tasks/$taskId/status';
    client.subscribe(topic, MqttQos.atLeastOnce);
    _subscription = client.updates?.listen((messages) {
      final payload = messages.first.payload as MqttPublishMessage;
      final text = MqttPublishPayload.bytesToStringAsString(
        payload.payload.message,
      );
      onEvent(
          TaskStatusEvent.fromJson(jsonDecode(text) as Map<String, dynamic>));
    });
    _client = client;
  }

  Future<void> disconnect() async {
    await _subscription?.cancel();
    _subscription = null;
    _client?.disconnect();
    _client = null;
  }
}
