import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Theme Base
  static const Color bgPage = Color(0xFF0E0E10);
  static const Color surfaceCard = Color(0xFF1A1A1D);
  static const Color surfaceRaised = Color(0xFF222226);
  static const Color surfaceHover = Color(0xFF28282D);
  static const Color border = Color(0xFF2E2E32);
  static const Color borderStrong = Color(0xFF3A3A3F);

  // Typography Colors
  static const Color textPrimary = Color(0xFFF5F4F0);
  static const Color textSecondary = Color(0xFFA3A29C);
  static const Color textMuted = Color(0xFF6B6A65);

  // Brand Accents
  static const Color accentPrimary = Color(0xFFFFB300); // Amber
  static const Color accentSecondary = Color(0xFFFF6A1F); // Orange
  static const Color success = Color(0xFF2ECC71);
  static const Color danger = Color(0xFFFF4D4D);
  static const Color warning = Color(0xFFFFB300);

  // Subject Functional Spines
  static const Color subjectPhysics = Color(0xFF5B8DEF);
  static const Color subjectChemistry = Color(0xFF2FD4A5);
  static const Color subjectMathematics = Color(0xFF8B7CF6);
  static const Color subjectBiology = Color(0xFF4CD97A);
  static const Color subjectComputerScience = Color(0xFFFF6FA8);
  static const Color subjectFoundation = Color(0xFFFF9F1C);

  static Color getSubjectColor(String slug) {
    final s = slug.toLowerCase().trim();
    if (s.contains('foundat')) return subjectFoundation;
    if (s.contains('physic')) return subjectPhysics;
    if (s.contains('chemist')) return subjectChemistry;
    if (s.contains('math')) return subjectMathematics;
    if (s.contains('bio')) return subjectBiology;
    if (s.contains('comput') || s == 'cs') return subjectComputerScience;
    return accentPrimary;
  }
}


class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bgPage,
      primaryColor: AppColors.accentPrimary,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.accentPrimary,
        secondary: AppColors.accentSecondary,
        surface: AppColors.surfaceCard,
        error: AppColors.danger,
      ),
      textTheme: GoogleFonts.ibmPlexSansTextTheme(
        ThemeData.dark().textTheme,
      ).apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bgPage,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      dividerColor: AppColors.border,
      cardColor: AppColors.surfaceCard,
    );
  }
}
