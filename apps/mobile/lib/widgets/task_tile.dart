import 'package:flutter/material.dart';

import '../models/recording_task.dart';
import 'stage_chip.dart';
import 'processing_card.dart';
import 'swipe_delete.dart';

class TaskTile extends StatelessWidget {
  const TaskTile({
    super.key,
    required this.task,
    required this.onTap,
    required this.onDelete,
  });

  final RecordingTask task;
  final VoidCallback onTap;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    return SwipeDelete(
      key: ValueKey(task.id),
      onDelete: onDelete,
      child: Card(
        child: Column(children: [
          ListTile(
            onTap: onTap,
            title: Text(
                task.summary?.isNotEmpty == true ? task.summary! : '录音任务',
                maxLines: 3,
                overflow: TextOverflow.ellipsis),
            subtitle: Text(_timeLabel(task.createdAt)),
            trailing: StageChip(stage: task.stage),
          ),
          if (!task.isFinished) ProcessingCard(task: task)
        ]),
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
