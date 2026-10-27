import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/quota.dart';
import '../models/recording_task.dart';
import '../services/api_client.dart';
import '../services/mqtt_service.dart';

class TaskStore extends ChangeNotifier {
  TaskStore({required this.api, required this.mqtt});

  final ApiClient api;
  final MqttService mqtt;
  final List<RecordingTask> _tasks = [];
  StreamSubscription<TaskStatusEvent>? _mqttSubscription;

  List<RecordingTask> get tasks => List.unmodifiable(_tasks);
  Quota? quota;
  bool loading = false;
  String? error;

  RecordingTask? taskById(String id) {
    for (final task in _tasks) {
      if (task.id == id) return task;
    }
    return null;
  }

  Future<void> initialize() async {
    _mqttSubscription = mqtt.events.listen(
      (event) => unawaited(refreshTask(event.taskId)),
    );
    await refreshAll();
    unawaited(mqtt.connect().catchError((_) {}));
  }

  Future<void> refreshAll() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait<Object>([
        api.getTasks(),
        api.getQuota(),
      ]);
      _tasks
        ..clear()
        ..addAll(results[0] as List<RecordingTask>);
      quota = results[1] as Quota;
    } catch (exception) {
      error = exception.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshTask(String taskId) async {
    try {
      final task = await api.getTask(taskId);
      final index = _tasks.indexWhere((item) => item.id == taskId);
      if (index == -1) {
        _tasks.insert(0, task);
      } else {
        _tasks[index] = task;
      }
      quota = await api.getQuota();
      notifyListeners();
    } catch (exception) {
      error = exception.toString();
      notifyListeners();
    }
  }

  Future<String> queryHistory(String question) => api.queryHistory(question);

  @override
  void dispose() {
    _mqttSubscription?.cancel();
    unawaited(mqtt.dispose());
    super.dispose();
  }
}
