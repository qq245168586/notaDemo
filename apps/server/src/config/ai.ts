import { loadEnvConfig } from '@next/env';
import path from 'node:path';

loadEnvConfig(process.cwd());

export const appConfig = {
  ai: {
    mode: process.env.AI_MODE === 'openai-compatible' ? 'openai-compatible' : 'mock',
    baseUrl: (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY ?? '',
    chatModel: process.env.AI_CHAT_MODEL ?? 'qwen-plus',
    asrProvider:
      process.env.AI_ASR_PROVIDER === 'openai-transcription'
        ? 'openai-transcription'
        : 'alibaba-chat',
    asrModel: process.env.AI_ASR_MODEL ?? 'qwen3-asr-flash',
  },
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883',
  mqttPort: Number(process.env.MQTT_PORT ?? 1883),
  timezone: process.env.NOTA_TIMEZONE ?? 'Asia/Shanghai',
  dataDir: process.env.DATA_DIR ?? path.join(process.cwd(), 'data'),
} as const;

export function assertRealAiConfig() {
  const missing = [['AI_API_KEY', appConfig.ai.apiKey]].filter(([, value]) => !value);

  if (missing.length) {
    throw new Error(`真实模型配置缺失: ${missing.map(([name]) => name).join(', ')}`);
  }
}
