class CreateTaskResult {
  const CreateTaskResult({
    required this.taskId,
    required this.status,
    required this.remainingQuota,
  });

  final String taskId;
  final String status;
  final int remainingQuota;

  factory CreateTaskResult.fromJson(Map<String, dynamic> json) {
    return CreateTaskResult(
      taskId: json['taskId'] as String,
      status: (json['status'] as String?) ?? 'PENDING',
      remainingQuota: (json['remainingQuota'] as num?)?.toInt() ?? 0,
    );
  }
}

class TaskStatusEvent {
  const TaskStatusEvent({required this.taskId, required this.stage});

  final String taskId;
  final String stage;

  factory TaskStatusEvent.fromJson(Map<String, dynamic> json) {
    return TaskStatusEvent(
      taskId: json['taskId'] as String,
      stage: (json['stage'] ?? json['status']) as String,
    );
  }
}

class TaskResult {
  const TaskResult({
    required this.id,
    required this.stage,
    this.summary,
    this.error,
  });

  final String id;
  final String stage;
  final String? summary;
  final String? error;

  bool get isCompleted => stage == 'COMPLETED';
  bool get isFailed => stage == 'FAILED';

  factory TaskResult.fromJson(Map<String, dynamic> json) {
    final task = (json['task'] as Map<String, dynamic>?) ?? json;
    return TaskResult(
      id: task['id'] as String,
      stage: (task['stage'] ?? task['status']) as String,
      summary: task['summary'] as String?,
      error: (task['error'] ?? task['errorMessage']) as String?,
    );
  }
}
