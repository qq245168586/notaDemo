import 'package:flutter/material.dart';

import '../controllers/simulator_controller.dart';
import '../widgets/record_card.dart';
import '../widgets/task_status_card.dart';

class SimulatorScreen extends StatefulWidget {
  const SimulatorScreen({super.key});

  @override
  State<SimulatorScreen> createState() => _SimulatorScreenState();
}

class _SimulatorScreenState extends State<SimulatorScreen> {
  late final SimulatorController controller;

  @override
  void initState() {
    super.initState();
    controller = SimulatorController.create();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nota Hardware Simulator')),
      body: SafeArea(
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('录一段语音，模拟硬件上传到 Nota 服务端。'),
                const SizedBox(height: 16),
                RecordCard(
                  isRecording: controller.isRecording,
                  isBusy: controller.isBusy,
                  onStart: controller.startRecording,
                  onStop: controller.stopAndUpload,
                ),
                const SizedBox(height: 12),
                TaskStatusCard(
                  stage: controller.stage,
                  taskId: controller.taskId,
                  remainingQuota: controller.remainingQuota,
                  summary: controller.summary,
                  error: controller.error,
                  onReset: controller.reset,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
