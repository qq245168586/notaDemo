import 'package:flutter/material.dart';

import '../state/task_store.dart';
import '../widgets/result_section.dart';
import '../widgets/stage_chip.dart';
import '../widgets/tool_call_card.dart';

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
    widget.store.refreshTask(widget.taskId);
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
              ResultSection(title: '原始转写', value: task.rawTranscript),
              ResultSection(title: '校准文本', value: task.correctedTranscript),
              ResultSection(title: 'AI 摘要', value: task.summary),
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
