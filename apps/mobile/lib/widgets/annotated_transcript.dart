import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../models/recording_task.dart';
import 'schedule_confirmation.dart';

class AnnotatedTranscript extends StatefulWidget {
  const AnnotatedTranscript({super.key, required this.task});
  final RecordingTask task;

  @override
  State<AnnotatedTranscript> createState() => _AnnotatedTranscriptState();
}

class _AnnotatedTranscriptState extends State<AnnotatedTranscript> {
  final Map<String, TapGestureRecognizer> _links = {};

  @override
  void dispose() {
    for (final link in _links.values) {
      link.dispose();
    }
    super.dispose();
  }

  Future<void> openReminder(Map<String, dynamic> item) async {
    final message = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => ScheduleConfirmation(
            kind: 'reminder',
            allowKindSelection: true,
            taskId: widget.task.id,
            item: {...item, 'when': item['quote']},
            notes: '来自 Nota 录音 ${widget.task.id}\n${item['context'] ?? ''}'));
    if (message != null && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text =
        widget.task.correctedTranscript ?? widget.task.rawTranscript ?? '';
    if (text.isEmpty) return const SizedBox.shrink();
    final spans = <InlineSpan>[];
    var offset = 0;
    for (final mention in widget.task.timeMentions) {
      final start = (mention['start'] as num?)?.toInt() ?? -1;
      final end = (mention['end'] as num?)?.toInt() ?? -1;
      if (start < offset ||
          end > text.length ||
          end <= start ||
          text.substring(start, end) != mention['quote']) {
        continue;
      }
      spans.add(TextSpan(text: text.substring(offset, start)));
      final id = mention['id'].toString();
      final link = _links.putIfAbsent(id, TapGestureRecognizer.new)
        ..onTap = () => openReminder(mention);
      spans.add(TextSpan(
          text: text.substring(start, end),
          recognizer: link,
          semanticsLabel: '${mention['quote']}，点击添加提醒',
          style: const TextStyle(
              color: Color(0xff2456c4),
              backgroundColor: Color(0xffe6efff),
              decoration: TextDecoration.underline,
              decorationColor: Color(0xff2456c4),
              fontWeight: FontWeight.w600)));
      offset = end;
    }
    spans.add(TextSpan(text: text.substring(offset)));
    return Card(
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('转写结果', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                const Text('点击蓝色下划线时间，自动带入提醒时间和事项内容。',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 12),
                SelectableText.rich(TextSpan(
                    style: Theme.of(context).textTheme.bodyLarge,
                    children: spans)),
              ],
            )));
  }
}
