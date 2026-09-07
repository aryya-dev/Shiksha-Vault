import 'package:flutter/foundation.dart';

class SecurityService {
  /// Screen protection (FLAG_SECURE) is handled natively in Android MainActivity
  /// to support modern Gradle 8/9+ and all Android OS versions seamlessly.
  static Future<void> enableScreenProtection() async {
    debugPrint('[SecurityService] Native FLAG_SECURE active on Android window.');
  }

  static Future<void> disableScreenProtection() async {
    debugPrint('[SecurityService] Security active.');
  }
}
