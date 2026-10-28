import 'package:flutter/material.dart';

class TranscriptReviewCard extends StatelessWidget {
  const TranscriptReviewCard(
      {super.key, this.review, this.loading = false, this.error, this.onRetry});
  final Map<String, dynamic>? review;
  final bool loading;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final findings = (review?['findings'] as List? ?? []).whereType<Map>();
    return Card(
        child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AI 校验说明', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (loading) const LinearProgressIndicator(),
                Text(loading
                    ? '正在核对上下文、专名和时间表达…'
                    : (review?['summary'] ?? error ?? '转写完成后生成校验说明')
                        .toString()),
                const SizedBox(height: 8),
                if (review?['changes'] is Map)
                  Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                          '本次文本改动：「${(review!['changes'] as Map)['before']}」 → 「${(review!['changes'] as Map)['after'] == '' ? '（删除）' : (review!['changes'] as Map)['after']}」。删改是否正确仍需核对原音。')),
                const Text('这是文本复核的结论与依据摘要，没有声学置信分数；文字看起来通顺也可能识别错。',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                ...findings.map((item) => Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${item['decision']} · 原词「${item['original']}」',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          if ((item['candidate'] ?? '').toString().isNotEmpty)
                            Text('候选／校准词：${item['candidate']}'),
                          Text('依据与局限：${item['evidence']}'),
                        ]))),
                if (!loading && review == null && onRetry != null)
                  TextButton(onPressed: onRetry, child: const Text('补充校验说明')),
              ],
            )));
  }
}
