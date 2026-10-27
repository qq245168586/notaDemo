import 'package:flutter/material.dart';

class RecordCard extends StatelessWidget {
  const RecordCard({
    super.key,
    required this.isRecording,
    required this.isBusy,
    required this.onStart,
    required this.onStop,
  });

  final bool isRecording;
  final bool isBusy;
  final VoidCallback onStart;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(
              isRecording ? Icons.mic : Icons.mic_none,
              size: 54,
              color: isRecording ? Colors.red : null,
            ),
            const SizedBox(height: 12),
            Text(
              isRecording ? '正在录音' : '模拟硬件录音',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: isBusy ? null : (isRecording ? onStop : onStart),
              icon: Icon(isRecording ? Icons.stop : Icons.fiber_manual_record),
              label: Text(isRecording ? '停止并上传' : '开始录音'),
            ),
          ],
        ),
      ),
    );
  }
}
