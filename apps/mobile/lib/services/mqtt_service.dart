import 'dart:async';
import 'dart:convert';

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

class TaskStatusEvent {
  const TaskStatusEvent({required this.taskId, required this.stage});

  final String taskId;
  final String stage;
}

class MqttService {
  MqttService({required this.host, required this.port});

  final String host;
  final int port;
  final _events = StreamController<TaskStatusEvent>.broadcast();
  MqttServerClient? _client;
  StreamSubscription<List<MqttReceivedMessage<MqttMessage?>>>? _subscription;

  Stream<TaskStatusEvent> get events => _events.stream;

  Future<void> connect() async {
    if (_client?.connectionStatus?.state == MqttConnectionState.connected) {
      return;
    }

    final clientId = 'nota-mobile-${DateTime.now().millisecondsSinceEpoch}';
    final client = MqttServerClient(host, clientId)
      ..port = port
      ..keepAlivePeriod = 20
      ..connectTimeoutPeriod = 3000
      ..autoReconnect = true
      ..logging(on: false)
      ..connectionMessage =
          MqttConnectMessage().withClientIdentifier(clientId).startClean();
    client.setProtocolV311();

    try {
      await client.connect();
      client.subscribe('nota/tasks/+/status', MqttQos.atLeastOnce);
      _subscription = client.updates?.listen(_handleMessages);
      _client = client;
    } catch (_) {
      client.disconnect();
      rethrow;
    }
  }

  void _handleMessages(
    List<MqttReceivedMessage<MqttMessage?>> messages,
  ) {
    for (final message in messages) {
      final payload = message.payload;
      if (payload is! MqttPublishMessage) continue;

      final text = MqttPublishPayload.bytesToStringAsString(
        payload.payload.message,
      );
      final json = jsonDecode(text) as Map<String, dynamic>;
      final taskId = json['taskId']?.toString();
      if (taskId == null) continue;

      _events.add(TaskStatusEvent(
        taskId: taskId,
        stage: json['stage']?.toString() ?? 'PENDING',
      ));
    }
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _client?.disconnect();
    await _events.close();
  }
}
