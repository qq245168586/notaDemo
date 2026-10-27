abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3000',
  );

  static const mqttHost = String.fromEnvironment(
    'MQTT_HOST',
    defaultValue: '127.0.0.1',
  );

  static const mqttPort = int.fromEnvironment(
    'MQTT_PORT',
    defaultValue: 1883,
  );
}
