import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../models/task_models.dart';
import '../services/audio_recorder_service.dart';
import '../services/mqtt_task_service.dart';
import '../services/task_api_service.dart';

class SimulatorController extends ChangeNotifier {
  SimulatorController({
    required AudioRecorderService recorder,
    required TaskApiService api,
    required MqttTaskService mqtt,
  })  : _recorder = recorder,
        _api = api,
        _mqtt = mqtt;

  factory SimulatorController.create() => SimulatorController(
        recorder: AudioRecorderService(),
        api: const TaskApiService(AppConfig.apiBaseUrl),
        mqtt: MqttTaskService(
          host: AppConfig.mqttHost,
          port: AppConfig.mqttPort,
        ),
      );

  final AudioRecorderService _recorder;
  final TaskApiService _api;
  final MqttTaskService _mqtt;
  Timer? _poller;
  bool _refreshing = false;
  bool _disposed = false;

  bool isRecording = false;
  bool isBusy = false;
  String stage = 'READY';
  String? taskId;
  int? remainingQuota;
  String? summary;
  String? error;

  bool get canStart => !isRecording && !isBusy && stage != 'COMPLETED';

  Future<void> startRecording() async {
    _clearResult();
    try {
      await _recorder.start();
      isRecording = true;
      stage = 'RECORDING';
    } catch (exception) {
      error = exception.toString();
      stage = 'FAILED';
    }
    notifyListeners();
  }

  Future<void> stopAndUpload() async {
    if (!isRecording) return;
    isBusy = true;
    error = null;
    stage = 'UPLOADING';
    notifyListeners();

    try {
      final path = await _recorder.stop();
      isRecording = false;
      final created = await _api.upload(
        audioPath: path,
        requestId: _newRequestId(),
        transcriptHint: AppConfig.transcriptHint,
      );
      taskId = created.taskId;
      remainingQuota = created.remainingQuota;
      stage = created.status;
      notifyListeners();

      // 上传已成功；MQTT 只是通知，连接失败不能把后台任务标记为失败。
      _poller = Timer.periodic(const Duration(seconds: 2), (_) {
        unawaited(_refreshResult().catchError((_) {}));
      });
      unawaited(_mqtt
          .subscribe(taskId: created.taskId, onEvent: _onStatus)
          .catchError((_) {}));
      await _refreshResult();
    } catch (exception) {
      isRecording = false;
      isBusy = false;
      stage = 'FAILED';
      error = exception.toString();
      notifyListeners();
    }
  }

  Future<void> _onStatus(TaskStatusEvent event) async {
    if (_disposed || event.taskId != taskId) return;
    // MQTT 只提醒刷新，数据库里的状态才是最终结果。
    await _refreshResult().catchError((_) {});
  }

  Future<void> _refreshResult() async {
    final currentId = taskId;
    if (currentId == null || _refreshing || _disposed) return;
    _refreshing = true;
    try {
      final task = await _api.getTask(currentId);
      if (_disposed || taskId != currentId) return;
      stage = task.stage;
      summary = task.summary;
      error = task.error;
      isBusy = !task.isCompleted && !task.isFailed;
      if (!isBusy) _poller?.cancel();
      notifyListeners();
    } finally {
      _refreshing = false;
    }
  }

  Future<void> reset() async {
    await _mqtt.disconnect();
    _clearResult();
    notifyListeners();
  }

  void _clearResult() {
    _poller?.cancel();
    isRecording = false;
    isBusy = false;
    stage = 'READY';
    taskId = null;
    remainingQuota = null;
    summary = null;
    error = null;
  }

  String _newRequestId() {
    final random = Random().nextInt(1 << 32).toRadixString(16);
    return '${DateTime.now().microsecondsSinceEpoch}-$random';
  }

  @override
  void dispose() {
    _disposed = true;
    _poller?.cancel();
    unawaited(_mqtt.disconnect());
    unawaited(_recorder.dispose());
    super.dispose();
  }
}
