import 'package:flutter/material.dart';
import '../models/recording_task.dart';

const processingStages = {
  'PENDING': '已上传，等待处理',
  'AUDIO_PROCESSING': '准备音频',
  'ASR_PROCESSING': '语音转文字',
  'TEXT_CORRECTING': '校准转写',
  'TRANSCRIPT_REVIEWING': '检查可信度与疑似错词',
  'AGENT_RUNNING': 'AI 整理与工具调用',
  'RESULT_VALIDATING': '核验结果',
  'COMPLETED': '处理完成',
  'FAILED': '处理失败',
};

class ProcessingCard extends StatelessWidget {
  const ProcessingCard(
      {super.key, required this.task, this.showHistory = false});
  final RecordingTask task;
  final bool showHistory;

  @override
  Widget build(BuildContext context) {
    final stageIndex = processingStages.keys.toList().indexOf(task.stage);
    final preview =
        task.summary ?? task.correctedTranscript ?? task.rawTranscript;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (!task.isFinished) ...[
            const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 10),
          ],
          Expanded(child: Text(processingStages[task.stage] ?? task.stage)),
        ]),
        if (!task.isFinished) ...[
          const SizedBox(height: 10),
          LinearProgressIndicator(
              value: stageIndex <= 0 ? null : stageIndex / 7),
          const SizedBox(height: 6),
          const Text('准备音频 → 转写 → 校准 → AI 整理 → 核验',
              style: TextStyle(fontSize: 11)),
          if (preview?.isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(preview!,
                maxLines: showHistory ? 8 : 3, overflow: TextOverflow.ellipsis),
            const Text('正在生成，最终结果以完成后为准',
                style: TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ],
        if (showHistory)
          ...task.progress.map((entry) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('• ${entry['message']}'),
              )),
      ]),
    );
  }
}
