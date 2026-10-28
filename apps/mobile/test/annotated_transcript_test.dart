import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nota_mobile/models/recording_task.dart';
import 'package:nota_mobile/widgets/annotated_transcript.dart';

void main() {
  testWidgets('点击下划线时间，预填时间和事项且未确认不调用系统', (tester) async {
    const quote = '明天下午三点';
    final task = RecordingTask(
      id: 'time-task',
      stage: 'COMPLETED',
      createdAt: DateTime(2026, 10, 28),
      correctedTranscript: '$quote约张总吃饭。',
      timeMentions: const [
        {
          'id': 'time-0',
          'start': 0,
          'end': 6,
          'quote': quote,
          'title': '约张总吃饭',
          'context': '$quote约张总吃饭',
          'startAt': '2027-10-29T07:00:00.000Z',
          'remindBeforeMinutes': 60,
        }
      ],
    );
    await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: AnnotatedTranscript(task: task))));
    final span =
        tester.widget<SelectableText>(find.byType(SelectableText)).textSpan!;
    final link = span.children!
        .whereType<TextSpan>()
        .firstWhere((item) => item.recognizer != null);
    expect(link.text, quote);
    expect(link.style?.decoration, TextDecoration.underline);
    expect(link.recognizer, isA<TapGestureRecognizer>());
    final editable = tester
        .state<EditableTextState>(find.byType(EditableText))
        .renderEditable;
    final caret = editable.getLocalRectForCaret(const TextPosition(offset: 3));
    await tester
        .tapAt(editable.localToGlobal(caret.center + const Offset(2, 0)));
    await tester.pumpAndSettle();
    expect(find.text('2027-10-29 15:00'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '约张总吃饭');
    expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '确认保存'))
            .onPressed,
        isNotNull);
    expect(find.text('iOS 提醒事项'), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
  });
}
