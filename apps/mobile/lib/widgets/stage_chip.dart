import 'package:flutter/material.dart';
import 'processing_card.dart';

class StageChip extends StatelessWidget {
  const StageChip({super.key, required this.stage});

  final String stage;

  @override
  Widget build(BuildContext context) {
    final color = switch (stage) {
      'COMPLETED' => Colors.green,
      'FAILED' => Colors.red,
      _ => Colors.blue,
    };
    return Chip(
      label: Text(processingStages[stage] ?? stage),
      side: BorderSide(color: color.withValues(alpha: 0.35)),
      backgroundColor: color.withValues(alpha: 0.1),
      visualDensity: VisualDensity.compact,
    );
  }
}
