import 'dart:convert';

import 'package:flutter/material.dart';

class ResultSection extends StatelessWidget {
  const ResultSection({
    super.key,
    required this.title,
    required this.value,
  });

  final String title;
  final Object? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value.toString().isEmpty || value.toString() == '[]') {
      return const SizedBox.shrink();
    }
    final text = value is String
        ? value as String
        : const JsonEncoder.withIndent('  ').convert(value);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SelectableText(text),
          ],
        ),
      ),
    );
  }
}
