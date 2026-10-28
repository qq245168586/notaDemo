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
  Timer? _poller;
  bool _disposed = false;
  final Set<String> analyzingTasks = {};
  final Map<String, String> analysisErrors = {};
  final Set<String> _deletedTasks = {};

  RecordingTask _latest(RecordingTask incoming) {
    final existing = taskById(incoming.id);
    if (existing?.updatedAt != null &&
        incoming.updatedAt != null &&
        existing!.updatedAt!.isAfter(incoming.updatedAt!)) {
      return existing;
    }
    return incoming;
  }

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
    _poller = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!loading) unawaited(refreshAll(showLoading: false));
    });
    unawaited(mqtt.connect().catchError((_) {}));
  }

  Future<void> refreshAll({bool showLoading = true}) async {
    loading = true;
    error = null;
    if (showLoading) notifyListeners();
    try {
      final results = await Future.wait<Object>([
        api.getTasks(),
        api.getQuota(),
      ]);
      if (_disposed) return;
      final latest = (results[0] as List<RecordingTask>)
          .where((task) => !_deletedTasks.contains(task.id))
          .map(_latest)
          .toList();
      _tasks
        ..clear()
        ..addAll(latest);
      quota = results[1] as Quota;
    } catch (exception) {
      error = exception.toString();
    } finally {
      loading = false;
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> refreshTask(String taskId) async {
    if (_deletedTasks.contains(taskId)) return;
    try {
      final task = _latest(await api.getTask(taskId));
      if (_disposed || _deletedTasks.contains(taskId)) return;
      final index = _tasks.indexWhere((item) => item.id == taskId);
      if (index == -1) {
        _tasks.insert(0, task);
      } else {
        _tasks[index] = task;
      }
      if (task.isFinished) quota = await api.getQuota();
      if (!_disposed) notifyListeners();
    } catch (exception) {
      if (exception is ApiException && exception.statusCode == 404) {
        _deletedTasks.add(taskId);
        _tasks.removeWhere((task) => task.id == taskId);
      } else if (!_deletedTasks.contains(taskId)) {
        error = exception.toString();
      }
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> deleteTask(String taskId) async {
    await api.deleteTask(taskId);
    _deletedTasks.add(taskId);
    _tasks.removeWhere((task) => task.id == taskId);
    analysisErrors.remove(taskId);
    if (!_disposed) notifyListeners();
  }

  Future<String> queryHistory(String question) => api.queryHistory(question);

  Future<void> analyzeTask(String taskId) async {
    if (_disposed || !analyzingTasks.add(taskId)) return;
    analysisErrors.remove(taskId);
    notifyListeners();
    try {
      final task = _latest(await api.analyzeTask(taskId));
      if (_disposed) return;
      final index = _tasks.indexWhere((entry) => entry.id == taskId);
      if (index >= 0) _tasks[index] = task;
    } catch (error) {
      analysisErrors[taskId] = error.toString();
    } finally {
      analyzingTasks.remove(taskId);
      if (!_disposed) notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _poller?.cancel();
    _mqttSubscription?.cancel();
    unawaited(mqtt.dispose());
    super.dispose();
  }
}
