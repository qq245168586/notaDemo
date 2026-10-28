import 'package:flutter/material.dart';

/// 左滑只展开操作区，必须点击红色按钮才发起删除。
class SwipeDelete extends StatefulWidget {
  const SwipeDelete({super.key, required this.child, required this.onDelete});

  final Widget child;
  final Future<void> Function() onDelete;

  @override
  State<SwipeDelete> createState() => _SwipeDeleteState();
}

class _SwipeDeleteState extends State<SwipeDelete> {
  static const actionWidth = 88.0;
  bool _open = false;
  bool _deleting = false;
  double _drag = 0;

  Future<void> _delete() async {
    if (_deleting) return;
    setState(() => _deleting = true);
    try {
      await widget.onDelete();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('删除失败：$error')),
        );
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: Stack(
        children: [
          if (_open)
            Positioned.fill(
              child: Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  width: actionWidth,
                  height: double.infinity,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: FilledButton(
                      onPressed: _deleting ? null : _delete,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.red.shade700,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.red.shade700,
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _deleting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.delete_outline),
                                SizedBox(height: 4),
                                Text('删除'),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
          GestureDetector(
            onHorizontalDragStart: (_) => _drag = 0,
            onHorizontalDragUpdate: (details) {
              if (_deleting) return;
              _drag += details.delta.dx;
              if (_drag.abs() > 24 && _open != (_drag < 0)) {
                setState(() => _open = _drag < 0);
              }
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              transform:
                  Matrix4.translationValues(_open ? -actionWidth : 0, 0, 0),
              child: widget.child,
            ),
          ),
        ],
      ),
    );
  }
}
