import 'package:flutter/material.dart';
import '../models/recording_task.dart';
import '../services/system_schedule_service.dart';
import 'schedule_confirmation.dart';

class SystemScheduleCard extends StatelessWidget {
  const SystemScheduleCard({super.key, required this.task});
  final RecordingTask task;

  @override
  Widget build(BuildContext context) {
    if (task.stage != 'COMPLETED' || !SystemScheduleService.supported) {
      return const SizedBox.shrink();
    }
    final items = [...task.reminders, ...task.todos]
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    return Card(
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('添加到 iOS 系统',
                    style: Theme.of(context).textTheme.titleMedium),
                const Text('选定事项，确认时间后保存。'),
                ...items.map((item) => Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text((item['content'] ?? item['title'] ?? '录音事项')
                            .toString()),
                        if (item['when'] != null) Text(item['when'].toString()),
                        Wrap(spacing: 8, children: [
                          for (final kind in ['calendar', 'reminder'])
                            OutlinedButton.icon(
                              icon: Icon(kind == 'calendar'
                                  ? Icons.event
                                  : Icons.checklist),
                              label: Text(kind == 'calendar' ? '系统日历' : '提醒事项'),
                              onPressed: () async {
                                final message = await showDialog<String>(
                                    context: context,
                                    barrierDismissible: false,
                                    builder: (_) => ScheduleConfirmation(
                                        kind: kind,
                                        taskId: task.id,
                                        item: item,
                                        notes:
                                            '来自 Nota 录音 ${task.id}\n${task.summary ?? ''}'));
                                if (message != null && context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(message)));
                                }
                              },
                            ),
                        ]),
                      ],
                    ))),
              ],
            )));
  }
}
