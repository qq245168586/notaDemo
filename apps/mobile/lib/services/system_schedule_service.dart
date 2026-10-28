import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class SystemScheduleService {
  static const _channel = MethodChannel('nota/system_schedule');
  static bool get supported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  Future<bool> save({
    required String kind,
    required String taskId,
    required String itemId,
    required String title,
    required String notes,
    required DateTime startAt,
    required int remindBeforeMinutes,
  }) async {
    if (!supported) {
      throw PlatformException(code: 'IOS_ONLY', message: '请在 iOS App 中添加系统提醒');
    }
    final result = await _channel.invokeMapMethod<String, dynamic>('save', {
      'kind': kind,
      'key':
          '$taskId/$itemId/${startAt.millisecondsSinceEpoch}/$remindBeforeMinutes',
      'title': title,
      'notes': notes,
      'startAt': startAt.millisecondsSinceEpoch,
      'remindBeforeMinutes': remindBeforeMinutes,
    });
    return result?['alreadySaved'] == true;
  }
}
