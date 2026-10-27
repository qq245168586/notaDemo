import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxAsrBytes = Number(process.env.ASR_MAX_BYTES ?? 8 * 1024 * 1024);
const maxAsrSeconds = Number(process.env.ASR_MAX_SECONDS ?? 290);

async function readDuration(inputPath: string) {
  try {
    const { stdout } = await execFileAsync(process.env.FFPROBE_PATH ?? 'ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    return Number(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Qwen 的同步 ASR 会拒绝过大的 Base64 音频。小文件原样使用；大文件在本地
 * 转成 16 kHz、单声道、24 kbps MP3，尽量减少上传体积而保留语音清晰度。
 */
export async function prepareAudioForAsr(inputPath: string) {
  const stat = await fs.stat(inputPath);
  const duration = await readDuration(inputPath);
  if (stat.size <= maxAsrBytes && duration <= maxAsrSeconds) return [inputPath];

  const parsed = path.parse(inputPath);
  const outputPattern = path.join(parsed.dir, `${parsed.name}.asr-%03d.mp3`);
  await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '24k',
    '-f',
    'segment',
    '-segment_time',
    String(maxAsrSeconds),
    '-reset_timestamps',
    '1',
    outputPattern,
  ]);

  const prefix = `${parsed.name}.asr-`;
  const paths = (await fs.readdir(parsed.dir))
    .filter((name) => name.startsWith(prefix) && name.endsWith('.mp3'))
    .sort()
    .map((name) => path.join(parsed.dir, name));
  if (!paths.length) throw new Error('音频预处理没有生成可用分片');

  for (const outputPath of paths) {
    const output = await fs.stat(outputPath);
    if (output.size > maxAsrBytes) {
      throw new Error('音频分片仍超过同步ASR限制，请缩短录音后重试');
    }
  }
  return paths;
}
