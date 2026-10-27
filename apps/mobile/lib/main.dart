import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'screens/task_list_screen.dart';
import 'services/api_client.dart';
import 'services/mqtt_service.dart';
import 'state/task_store.dart';

void main() {
  final store = TaskStore(
    api: ApiClient(baseUrl: AppConfig.apiBaseUrl),
    mqtt: MqttService(
      host: AppConfig.mqttHost,
      port: AppConfig.mqttPort,
    ),
  );
  runApp(NotaApp(store: store));
}

class NotaApp extends StatelessWidget {
  const NotaApp({super.key, required this.store});

  final TaskStore store;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nota',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff536dfe)),
        useMaterial3: true,
      ),
      home: TaskListScreen(store: store),
    );
  }
}
