import 'package:flutter_test/flutter_test.dart';
import 'package:nota_hardware_simulator/controllers/simulator_controller.dart';
import 'package:nota_hardware_simulator/models/task_models.dart';
import 'package:nota_hardware_simulator/services/audio_recorder_service.dart';
import 'package:nota_hardware_simulator/services/mqtt_task_service.dart';
import 'package:nota_hardware_simulator/services/task_api_service.dart';

class FakeRecorder extends AudioRecorderService {
  @override
  Future<void> start() async {}
  @override
  Future<String> stop() async => '/tmp/test.m4a';
  @override
  Future<void> dispose() async {}
}

class FakeApi extends TaskApiService {
  FakeApi() : super('http://localhost');
  int uploads = 0;
  String status = 'ASR_PROCESSING';

  @override
  Future<CreateTaskResult> upload({
    required String audioPath,
    required String requestId,
    required String transcriptHint,
  }) async {
    uploads++;
    return const CreateTaskResult(
      taskId: 'one-task',
      status: 'PENDING',
      remainingQuota: 9,
    );
  }

  @override
  Future<TaskResult> getTask(String taskId) async => TaskResult(
        id: taskId,
        stage: status,
        summary: status == 'COMPLETED' ? '真实处理结果' : null,
        error: status == 'FAILED' ? 'ASR服务不可用' : null,
      );
}

class UnavailableMqtt extends MqttTaskService {
  UnavailableMqtt() : super(host: 'localhost', port: 1);
  @override
  Future<void> subscribe({
    required String taskId,
    required void Function(TaskStatusEvent event) onEvent,
  }) async =>
      throw StateError('Broker不可用');
}

void main() {
  testWidgets('MQTT失败后继续查询，展示完成结果且不重复上传', (tester) async {
    final api = FakeApi();
    final controller = SimulatorController(
      recorder: FakeRecorder(),
      api: api,
      mqtt: UnavailableMqtt(),
    );
    await controller.startRecording();
    await controller.stopAndUpload();
    expect(controller.stage, 'ASR_PROCESSING');
    expect(controller.error, isNull);
    expect(controller.isBusy, isTrue);

    api.status = 'COMPLETED';
    await tester.pump(const Duration(seconds: 2));
    expect(controller.stage, 'COMPLETED');
    expect(controller.summary, '真实处理结果');
    expect(controller.isBusy, isFalse);
    expect(api.uploads, 1);
    controller.dispose();
  });

  testWidgets('后台真实失败时展示服务端错误', (tester) async {
    final api = FakeApi()..status = 'FAILED';
    final controller = SimulatorController(
      recorder: FakeRecorder(),
      api: api,
      mqtt: UnavailableMqtt(),
    );
    await controller.startRecording();
    await controller.stopAndUpload();
    expect(controller.stage, 'FAILED');
    expect(controller.error, 'ASR服务不可用');
    expect(controller.isBusy, isFalse);
    controller.dispose();
  });
}
