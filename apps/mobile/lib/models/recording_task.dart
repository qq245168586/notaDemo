class ToolCallRecord {
  const ToolCallRecord({
    required this.name,
    required this.arguments,
    required this.result,
  });

  final String name;
  final Object? arguments;
  final Object? result;

  factory ToolCallRecord.fromJson(Map<String, dynamic> json) => ToolCallRecord(
        name: (json['name'] ?? json['tool'] ?? 'unknown').toString(),
        arguments: json['arguments'] ?? json['input'],
        result: json['result'] ?? json['output'],
      );
}

class RecordingTask {
  const RecordingTask({
    required this.id,
    required this.stage,
    required this.createdAt,
    this.rawTranscript,
    this.correctedTranscript,
    this.summary,
    this.todos = const [],
    this.reminders = const [],
    this.toolCalls = const [],
    this.error,
    this.progress = const [],
    this.updatedAt,
    this.review,
    this.timeMentions = const [],
  });

  final String id;
  final String stage;
  final DateTime? createdAt;
  final String? rawTranscript;
  final String? correctedTranscript;
  final String? summary;
  final List<Object?> todos;
  final List<Object?> reminders;
  final List<ToolCallRecord> toolCalls;
  final String? error;
  final List<Map<String, dynamic>> progress;
  final DateTime? updatedAt;
  final Map<String, dynamic>? review;
  final List<Map<String, dynamic>> timeMentions;

  bool get isFinished => stage == 'COMPLETED' || stage == 'FAILED';

  factory RecordingTask.fromJson(Map<String, dynamic> json) {
    final rawCalls = json['toolCalls'] as List<dynamic>? ?? const [];
    return RecordingTask(
      id: (json['id'] ?? json['taskId']).toString(),
      stage: (json['stage'] ?? json['status'] ?? 'PENDING').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      rawTranscript: json['rawTranscript']?.toString(),
      correctedTranscript: json['correctedTranscript']?.toString(),
      summary: json['summary']?.toString(),
      todos: List<Object?>.from(json['todos'] as List<dynamic>? ?? const []),
      reminders:
          List<Object?>.from(json['reminders'] as List<dynamic>? ?? const []),
      toolCalls: rawCalls
          .whereType<Map>()
          .map((item) => ToolCallRecord.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(),
      error: json['error']?.toString(),
      review: json['review'] is Map
          ? Map<String, dynamic>.from(json['review'] as Map)
          : null,
      timeMentions: (json['timeMentions'] as List<dynamic>? ?? [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      updatedAt: DateTime.tryParse((json['updatedAt'] ?? '').toString()),
      progress: (json['progress'] as List<dynamic>? ?? [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
    );
  }
}
