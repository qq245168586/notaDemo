import 'package:flutter/material.dart';

import '../state/task_store.dart';
import '../widgets/result_section.dart';
import '../widgets/stage_chip.dart';
import '../widgets/tool_call_card.dart';
import '../widgets/processing_card.dart';
import '../widgets/system_schedule_card.dart';
import '../widgets/annotated_transcript.dart';
import '../widgets/transcript_review_card.dart';

class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({
    super.key,
    required this.taskId,
    required this.store,
  });

  final String taskId;
  final TaskStore store;

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadTask();
  }

  Future<void> _loadTask() async {
    await widget.store.refreshTask(widget.taskId);
    final task = widget.store.taskById(widget.taskId);
    if (mounted && task?.stage == 'COMPLETED' && task?.review == null) {
      await widget.store.analyzeTask(widget.taskId);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.store.refreshTask(widget.taskId);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('任务详情'),
        actions: [
          IconButton(
            tooltip: '刷新',
            onPressed: () => widget.store.refreshTask(widget.taskId),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: widget.store,
        builder: (context, _) {
          final task = widget.store.taskById(widget.taskId);
          if (task == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      task.id,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  StageChip(stage: task.stage),
                ],
              ),
              AnnotatedTranscript(task: task),
              TranscriptReviewCard(
                  review: task.review,
                  loading: widget.store.analyzingTasks.contains(task.id),
                  error: widget.store.analysisErrors[task.id],
                  onRetry: task.stage == 'COMPLETED'
                      ? () => widget.store.analyzeTask(task.id)
                      : null),
              Card(child: ProcessingCard(task: task, showHistory: true)),
              ResultSection(title: 'AI 摘要', value: task.summary),
              SystemScheduleCard(task: task),
              ResultSection(title: '原始转写（供对照）', value: task.rawTranscript),
              ResultSection(title: '待办', value: task.todos),
              ResultSection(title: '提醒', value: task.reminders),
              if (task.toolCalls.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 4),
                  child: Text('Agent 工具调用',
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                ...task.toolCalls.map((call) => ToolCallCard(call: call)),
              ],
              if (task.error != null)
                ResultSection(title: '错误', value: task.error),
            ],
          );
        },
      ),
    );
  }
}
