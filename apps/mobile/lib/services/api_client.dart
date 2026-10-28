import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/quota.dart';
import '../models/recording_task.dart';

class ApiClient {
  ApiClient({required String baseUrl})
      : baseUrl = baseUrl.replaceFirst(RegExp(r'/$'), '');

  final String baseUrl;

  Future<List<RecordingTask>> getTasks() async {
    final response = await http.get(Uri.parse('$baseUrl/api/tasks'));
    final body = _decode(response);
    final items = body['tasks'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map>()
        .map((item) => RecordingTask.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList();
  }

  Future<RecordingTask> getTask(String taskId) async {
    final response = await http.get(Uri.parse('$baseUrl/api/tasks/$taskId'));
    final body = _decode(response);
    final task = body['task'] as Map? ?? body;
    return RecordingTask.fromJson(Map<String, dynamic>.from(task));
  }

  Future<Quota> getQuota() async {
    final response = await http.get(Uri.parse('$baseUrl/api/quota'));
    return Quota.fromJson(_decode(response));
  }

  Future<void> deleteTask(String taskId) async {
    _decode(await http.delete(Uri.parse('$baseUrl/api/tasks/$taskId')));
  }

  Future<RecordingTask> analyzeTask(String taskId) async {
    final response =
        await http.post(Uri.parse('$baseUrl/api/tasks/$taskId/analyze'));
    return RecordingTask.fromJson(
        Map<String, dynamic>.from(_decode(response)['task'] as Map));
  }

  Future<String> queryHistory(String question) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/agent/query'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'question': question}),
    );
    final body = _decode(response);
    return (body['answer'] ?? body['result'] ?? body).toString();
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        decoded['error']?.toString() ?? 'HTTP ${response.statusCode}',
        statusCode: response.statusCode,
      );
    }
    return decoded;
  }
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
