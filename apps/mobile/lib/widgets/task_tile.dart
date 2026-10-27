import 'package:flutter/material.dart';

import '../models/recording_task.dart';
import 'stage_chip.dart';

class TaskTile extends StatelessWidget {
  const TaskTile({
    super.key,
    required this.task,
    required this.onTap,
  });

  final RecordingTask task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text(task.summary?.isNotEmpty == true ? task.summary! : '录音任务'),
        subtitle: Text(_timeLabel(task.createdAt)),
        trailing: StageChip(stage: task.stage),
      ),
    );
  }

  String _timeLabel(DateTime? value) {
    if (value == null) return task.id;
    final local = value.toLocal();
    String twoDigits(int number) => number.toString().padLeft(2, '0');
    return '${local.year}-${twoDigits(local.month)}-${twoDigits(local.day)} '
        '${twoDigits(local.hour)}:${twoDigits(local.minute)}';
  }
}
