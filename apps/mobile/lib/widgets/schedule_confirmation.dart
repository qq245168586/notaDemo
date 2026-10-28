import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/system_schedule_service.dart';

class ScheduleConfirmation extends StatefulWidget {
  const ScheduleConfirmation(
      {super.key,
      required this.kind,
      required this.taskId,
      required this.item,
      required this.notes,
      this.allowKindSelection = false});
  final String kind;
  final String taskId;
  final Map<String, dynamic> item;
  final String notes;
  final bool allowKindSelection;

  @override
  State<ScheduleConfirmation> createState() => _ScheduleConfirmationState();
}

class _ScheduleConfirmationState extends State<ScheduleConfirmation> {
  late final title = TextEditingController(
    text: (widget.item['content'] ?? widget.item['title'] ?? '录音事项').toString(),
  );
  DateTime? selected;
  late String kind = widget.kind;
  int leadMinutes = 0;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    selected =
        DateTime.tryParse((widget.item['startAt'] ?? '').toString())?.toLocal();
    leadMinutes = (widget.item['remindBeforeMinutes'] as num?)?.toInt() ?? 0;
  }

  @override
  void dispose() {
    title.dispose();
    super.dispose();
  }

  Future<void> pickTime() async {
    final now = DateTime.now();
    final suggested = selected ??
        DateTime.tryParse((widget.item['date'] ?? '').toString()) ??
        now.add(const Duration(days: 1));
    final day = await showDatePicker(
        context: context,
        initialDate: suggested,
        firstDate:
            DateTime(suggested.year < now.year ? suggested.year : now.year),
        lastDate: DateTime(
            (suggested.year > now.year ? suggested.year : now.year) + 5));
    if (day == null || !mounted) return;
    final time = await showTimePicker(
        context: context,
        initialTime: selected == null
            ? const TimeOfDay(hour: 9, minute: 0)
            : TimeOfDay.fromDateTime(selected!));
    if (time == null || !mounted) return;
    setState(() {
      selected = DateTime(day.year, day.month, day.day, time.hour, time.minute);
      error = null;
    });
  }

  Future<void> save() async {
    final date = selected;
    if (date == null || title.text.trim().isEmpty) return;
    if (!date
        .subtract(Duration(minutes: leadMinutes))
        .isAfter(DateTime.now())) {
      setState(() => error = '提醒时间已过去，请调整日期或提前量');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final existing = await SystemScheduleService().save(
        kind: kind,
        taskId: widget.taskId,
        itemId: (widget.item['id'] ?? title.text).toString(),
        title: title.text.trim(),
        notes: widget.notes,
        startAt: date,
        remindBeforeMinutes: leadMinutes,
      );
      if (mounted) {
        Navigator.pop(
            context,
            existing
                ? '已添加过，无需重复保存'
                : '已保存到系统${kind == 'calendar' ? '日历' : '提醒事项'}');
      }
    } on PlatformException catch (exception) {
      if (mounted) setState(() => error = exception.message ?? '保存失败');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(kind == 'calendar' ? '添加到日历' : '添加到提醒事项'),
        content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (widget.allowKindSelection)
            DropdownButtonFormField<String>(
                value: kind,
                decoration: const InputDecoration(labelText: '保存到'),
                items: const [
                  DropdownMenuItem(value: 'reminder', child: Text('iOS 提醒事项')),
                  DropdownMenuItem(value: 'calendar', child: Text('iOS 系统日历'))
                ],
                onChanged: saving
                    ? null
                    : (value) => setState(() => kind = value ?? 'reminder')),
          TextField(
              controller: title,
              decoration: const InputDecoration(labelText: '事项标题')),
          if (widget.item['when'] != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text('录音中的时间：${widget.item['when']}')),
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text('请确认具体日期和时间，未确认前不会写入系统。')),
          if (widget.item['note'] != null)
            Text(widget.item['note'].toString(),
                style: const TextStyle(fontSize: 12)),
          OutlinedButton.icon(
              onPressed: saving ? null : pickTime,
              icon: const Icon(Icons.schedule),
              label: Text(selected == null
                  ? '选择日期和时间'
                  : selected!.toString().substring(0, 16))),
          DropdownButtonFormField<int>(
              value: leadMinutes,
              decoration: const InputDecoration(labelText: '提醒时间'),
              items: ({0, 10, 30, 60, 1440, leadMinutes}.toList()..sort())
                  .map((minutes) => DropdownMenuItem(
                      value: minutes,
                      child: Text(minutes == 0
                          ? '准时提醒'
                          : minutes == 1440
                              ? '提前 1 天'
                              : minutes == 60
                                  ? '提前 1 小时'
                                  : '提前 $minutes 分钟')))
                  .toList(),
              onChanged: saving
                  ? null
                  : (value) => setState(() => leadMinutes = value ?? 0)),
          if (kind == 'calendar')
            const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('日历事件默认持续 1 小时。')),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
        ])),
        actions: [
          TextButton(
              onPressed: saving ? null : () => Navigator.pop(context),
              child: const Text('取消')),
          FilledButton(
              onPressed: saving || selected == null ? null : save,
              child: Text(saving ? '正在保存…' : '确认保存'))
        ],
      );
}
