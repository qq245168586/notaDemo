import 'package:flutter/material.dart';

import '../models/quota.dart';

class QuotaCard extends StatelessWidget {
  const QuotaCard({super.key, required this.quota});

  final Quota? quota;

  @override
  Widget build(BuildContext context) {
    final current = quota;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.bolt_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('本轮额度（10 次后重置）',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(current == null
                      ? '正在读取…'
                      : '剩余 ${current.remaining}/${current.limit}，处理中 ${current.reserved}'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
