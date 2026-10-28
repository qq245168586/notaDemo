import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nota_mobile/models/recording_task.dart';
import 'package:nota_mobile/widgets/task_tile.dart';

const task =
    RecordingTask(id: 'test-task', stage: 'COMPLETED', createdAt: null);

void main() {
  testWidgets('左滑仅显示删除按钮，点击后才删除任务', (tester) async {
    var exists = true;
    var calls = 0;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: StatefulBuilder(
      builder: (context, setState) => ListView(children: [
        if (exists)
          TaskTile(
              task: task,
              onTap: () {},
              onDelete: () async {
                calls++;
                setState(() => exists = false);
              }),
      ]),
    ))));
    expect(find.text('删除'), findsNothing);
    await tester.drag(find.byType(TaskTile), const Offset(-600, 0));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.byType(TaskTile), findsOneWidget);
    expect(find.text('删除'), findsOneWidget);
    await tester.tap(find.text('删除'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.byType(TaskTile), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('向右滑动收起操作区，不触发删除', (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: TaskTile(
      task: task,
      onTap: () {},
      onDelete: () async {
        calls++;
      },
    ))));
    await tester.drag(find.byType(TaskTile), const Offset(-300, 0));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListTile), const Offset(300, 0));
    await tester.pumpAndSettle();
    expect(find.text('删除'), findsNothing);
    expect(calls, 0);
  });

  testWidgets('删除失败时保留任务并提示', (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: TaskTile(
      task: task,
      onTap: () {},
      onDelete: () async => throw Exception('网络断开'),
    ))));
    await tester.drag(find.byType(TaskTile), const Offset(-600, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除'));
    await tester.pumpAndSettle();
    expect(find.byType(TaskTile), findsOneWidget);
    expect(find.textContaining('删除失败'), findsOneWidget);
    expect(find.text('删除'), findsOneWidget);
  });

  testWidgets('请求未完成时不能重复点击删除', (tester) async {
    var calls = 0;
    final pending = Completer<void>();
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: TaskTile(
      task: task,
      onTap: () {},
      onDelete: () {
        calls++;
        return pending.future;
      },
    ))));
    await tester.drag(find.byType(TaskTile), const Offset(-300, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除'));
    await tester.pump();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
    expect(calls, 1);
    pending.complete();
    await tester.pumpAndSettle();
  });
}
