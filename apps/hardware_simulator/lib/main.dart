import 'package:flutter/material.dart';

import 'screens/simulator_screen.dart';

void main() {
  runApp(const NotaHardwareSimulator());
}

class NotaHardwareSimulator extends StatelessWidget {
  const NotaHardwareSimulator({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nota Hardware Simulator',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF3949AB)),
        useMaterial3: true,
      ),
      home: const SimulatorScreen(),
    );
  }
}
