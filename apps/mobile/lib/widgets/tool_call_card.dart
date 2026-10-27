import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/recording_task.dart';

class ToolCallCard extends StatelessWidget {
  const ToolCallCard({super.key, required this.call});

  final ToolCallRecord call;

  @override
  Widget build(BuildContext context) {
    String pretty(Object? value) =>
        value == null ? '-' : const JsonEncoder.withIndent('  ').convert(value);

    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.build_outlined),
        title: Text(call.name),
        subtitle: const Text('查看 Agent 输入与结果'),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('参数'),
          SelectableText(pretty(call.arguments)),
          const SizedBox(height: 12),
          const Text('结果'),
          SelectableText(pretty(call.result)),
        ],
      ),
    );
  }
}
