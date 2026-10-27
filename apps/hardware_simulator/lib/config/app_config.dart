class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static const mqttHost = String.fromEnvironment(
    'MQTT_HOST',
    defaultValue: '10.0.2.2',
  );

  static const mqttPort = int.fromEnvironment(
    'MQTT_PORT',
    defaultValue: 1883,
  );

  // The mock server uses this text when no real ASR key is configured.
  static const transcriptHint = String.fromEnvironment(
    'TRANSCRIPT_HINT',
    defaultValue: '下周三下午三点整理 Nota 演示材料，并提前一天提醒我。',
  );
}
