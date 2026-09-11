import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/theme.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase with your project URL and Anon Key
  // In production, configure through dart-define or config
  await Supabase.initialize(
    url: const String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: 'https://hgsfflqydnnhghfvfmrc.supabase.co',
    ),
    anonKey: const String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnc2ZmbHF5ZG5uaGdoZnZmbXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTc3MzksImV4cCI6MjEwNDI5MzczOX0.ODfklKhluqC9oju6W1vc0rPlo9cCSWElDpipo7cC6PI',
    ),
  );

  runApp(const ShikshaVaultApp());
}

class ShikshaVaultApp extends StatelessWidget {
  const ShikshaVaultApp({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Supabase.instance.client.auth.currentSession;

    return MaterialApp(
      title: 'Shiksharthi Educational Institute',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: session != null ? const HomeScreen() : const LoginScreen(),
    );
  }
}
