import 'package:flutter/material.dart';

import '../state/task_store.dart';

class HistoryQueryCard extends StatefulWidget {
  const HistoryQueryCard({super.key, required this.store});

  final TaskStore store;

  @override
  State<HistoryQueryCard> createState() => _HistoryQueryCardState();
}

class _HistoryQueryCardState extends State<HistoryQueryCard> {
  final _controller = TextEditingController();
  String? _answer;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final question = _controller.text.trim();
    if (question.isEmpty || _loading) return;
    setState(() {
      _loading = true;
      _answer = null;
    });
    try {
      final answer = await widget.store.queryHistory(question);
      if (mounted) setState(() => _answer = answer);
    } catch (error) {
      if (mounted) setState(() => _answer = '查询失败：$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('查询历史记录', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _controller,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                hintText: '例如：上次和张总聊的报价是多少？',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  onPressed: _loading ? null : _submit,
                  icon: _loading
                      ? const Padding(
                          padding: EdgeInsets.all(10),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_outlined),
                ),
              ),
            ),
            if (_answer != null) ...[
              const SizedBox(height: 12),
              SelectableText(_answer!),
            ],
          ],
        ),
      ),
    );
  }
}
