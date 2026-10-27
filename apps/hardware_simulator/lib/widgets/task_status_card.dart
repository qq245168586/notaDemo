import 'package:flutter/material.dart';

class TaskStatusCard extends StatelessWidget {
  const TaskStatusCard({
    super.key,
    required this.stage,
    this.taskId,
    this.remainingQuota,
    this.summary,
    this.error,
    this.onReset,
  });

  final String stage;
  final String? taskId;
  final int? remainingQuota;
  final String? summary;
  final String? error;
  final VoidCallback? onReset;

  @override
  Widget build(BuildContext context) {
    final failed = stage == 'FAILED';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('状态：$stage', style: Theme.of(context).textTheme.titleMedium),
            if (taskId != null) ...[
              const SizedBox(height: 8),
              SelectableText('Task ID：$taskId'),
            ],
            if (remainingQuota != null) ...[
              const SizedBox(height: 8),
              Text('今日剩余：$remainingQuota 次'),
            ],
            if (summary != null) ...[
              const Divider(height: 28),
              Text('摘要', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Text(summary!),
            ],
            if (error != null) ...[
              const Divider(height: 28),
              Text(error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            if ((failed || stage == 'COMPLETED') && onReset != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: onReset,
                child: Text(failed ? '重新开始' : '再录一条'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
