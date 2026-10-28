import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nota_mobile/services/system_schedule_service.dart';
import 'package:nota_mobile/widgets/schedule_confirmation.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('nota/system_schedule');
  late List<MethodCall> calls;
  setUp(() {
    calls = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return {'id': 'saved-item', 'alreadySaved': false};
    });
  });
  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('传给 iOS 的时间和提前量保持准确', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    final date = DateTime(2027, 3, 5, 15);
    await SystemScheduleService().save(
        kind: 'calendar',
        taskId: 'task',
        itemId: 'reminder',
        title: '开会',
        notes: '录音来源',
        startAt: date,
        remindBeforeMinutes: 1440);
    final args = calls.single.arguments as Map;
    expect(args['startAt'], date.millisecondsSinceEpoch);
    expect(args['remindBeforeMinutes'], 1440);
    expect(args['kind'], 'calendar');
  });

  testWidgets('未确认日期时不能保存，取消不会调用系统接口', (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: Builder(
            builder: (context) => TextButton(
                onPressed: () => showDialog<void>(
                    context: context,
                    builder: (_) => const ScheduleConfirmation(
                        kind: 'reminder',
                        taskId: 'task',
                        item: {'title': '开会', 'when': '下周三下午'},
                        notes: '录音')),
                child: const Text('打开')))));
    await tester.tap(find.text('打开'));
    await tester.pumpAndSettle();
    expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '确认保存'))
            .onPressed,
        isNull);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(calls, isEmpty);
  });
}
