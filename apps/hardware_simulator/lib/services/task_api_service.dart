import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/task_models.dart';

class TaskApiService {
  const TaskApiService(this.baseUrl);

  final String baseUrl;

  Future<CreateTaskResult> upload({
    required String audioPath,
    required String requestId,
    required String transcriptHint,
  }) async {
    final request =
        http.MultipartRequest('POST', Uri.parse('$baseUrl/api/tasks'))
          ..fields['requestId'] = requestId
          ..fields['transcriptHint'] = transcriptHint
          ..files.add(await http.MultipartFile.fromPath('audio', audioPath));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HttpException(_errorMessage(response));
    }

    return CreateTaskResult.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<TaskResult> getTask(String taskId) async {
    final response = await http.get(Uri.parse('$baseUrl/api/tasks/$taskId'));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw HttpException(_errorMessage(response));
    }
    return TaskResult.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>);
  }

  String _errorMessage(http.Response response) {
    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return (json['error'] ?? json['message'] ?? '请求失败') as String;
    } catch (_) {
      return '请求失败 (${response.statusCode})';
    }
  }
}
