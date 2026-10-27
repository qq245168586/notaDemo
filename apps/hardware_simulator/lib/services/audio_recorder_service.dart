import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

class AudioRecorderService {
  final AudioRecorder _recorder = AudioRecorder();

  Future<void> start() async {
    if (!await _recorder.hasPermission()) {
      throw StateError('没有麦克风权限');
    }

    final directory = await getTemporaryDirectory();
    final path =
        '${directory.path}/nota-${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path: path,
    );
  }

  Future<String> stop() async {
    final path = await _recorder.stop();
    if (path == null) throw StateError('没有生成录音文件');
    return path;
  }

  Future<void> dispose() => _recorder.dispose();
}
