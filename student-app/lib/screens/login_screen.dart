import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;
  bool _mustChangePassword = false;

  Future<void> _handleLogin() async {
    final code = _codeController.text.trim().toUpperCase();
    final password = _passwordController.text;

    if (code.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter both your Student ID and password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // In Shiksharthi, students log in with their Student Code formatted as synthetic email
      final email = '${code.toLowerCase()}@student.shiksharthi.in';
      
      final authResponse = await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (authResponse.user != null) {
        // Check student active status and password change requirement
        final student = await Supabase.instance.client
            .from('students')
            .select()
            .eq('id', authResponse.user!.id)
            .single();

        if (student['is_active'] == false) {
          await Supabase.instance.client.auth.signOut();
          throw 'Your account has been deactivated. Please contact the institute administration.';
        }

        if (student['must_change_password'] == true) {
          setState(() {
            _mustChangePassword = true;
            _isLoading = false;
          });
          return;
        }

        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      final errLower = e.toString().toLowerCase();
      String friendly;

      if (errLower.contains('invalid login credentials') ||
          errLower.contains('invalid_credentials')) {
        friendly = 'Incorrect Student Code or Password. Please verify and try again.';
      } else if (errLower.contains('network') ||
          errLower.contains('socket') ||
          errLower.contains('failed host lookup') ||
          errLower.contains('clientexception') ||
          errLower.contains('connection')) {
        friendly = 'Unable to connect to server. Please check your internet connection.';
      } else if (errLower.contains('deactivated')) {
        friendly = 'Your student account has been deactivated. Please contact institute administration.';
      } else if (errLower.contains('rate limit') || errLower.contains('too many')) {
        friendly = 'Too many login attempts. Please wait a minute and try again.';
      } else if (errLower.contains('500') || errLower.contains('database error')) {
        friendly = 'The server is temporarily undergoing maintenance. Please try again shortly.';
      } else {
        friendly = 'Login failed. Please check your credentials or contact institute administration.';
      }

      setState(() {
        _errorMessage = friendly;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handlePasswordUpdate() async {
    final newPass = _newPasswordController.text;
    if (newPass.length < 6) {
      setState(() {
        _errorMessage = 'Password must be at least 6 characters long.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: newPass),
      );

      final user = Supabase.instance.client.auth.currentUser;
      if (user != null) {
        await Supabase.instance.client
            .from('students')
            .update({'must_change_password': false})
            .eq('id', user.id);
      }

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (e) {
      final errLower = e.toString().toLowerCase();
      String friendly;
      if (errLower.contains('network') ||
          errLower.contains('connection') ||
          errLower.contains('socket') ||
          errLower.contains('failed host lookup')) {
        friendly = 'Unable to update password. Please check your internet connection.';
      } else if (errLower.contains('weak') ||
          errLower.contains('should contain') ||
          errLower.contains('least')) {
        friendly = 'Please choose a stronger password (at least 6 characters).';
      } else {
        friendly = 'Could not update password. Please try again or contact administration.';
      }
      setState(() {
        _errorMessage = friendly;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPage,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Official Logo
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Image.asset(
                      'assets/images/shiksharthi_logo.png',
                      height: 60,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  _mustChangePassword 
                      ? 'Set your permanent password'
                      : 'Shiksha Vault • Student Document Portal',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 30),

                // Error message banner
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.12),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppColors.danger, fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 18),
                ],

                if (!_mustChangePassword) ...[
                  // Student Code Input
                  const Text(
                    'Student ID / Code',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _codeController,
                    textCapitalization: TextCapitalization.characters,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      hintText: 'e.g. SH2026-101',
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.textMuted, size: 20),
                      filled: true,
                      fillColor: AppColors.surfaceCard,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.accentPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Password Input
                  const Text(
                    'Password',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: '••••••••••••',
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.textMuted, size: 20),
                      filled: true,
                      fillColor: AppColors.surfaceCard,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.accentPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Login Button
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentPrimary,
                      foregroundColor: AppColors.bgPage,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPage),
                          )
                        : const Text(
                            'Sign In',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                          ),
                  ),
                ] else ...[
                  // Forced Password Change
                  const Text(
                    'Create New Password',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _newPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Minimum 6 characters',
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.lock_reset_rounded, color: AppColors.accentPrimary, size: 20),
                      filled: true,
                      fillColor: AppColors.surfaceCard,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.accentPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: _isLoading ? null : _handlePasswordUpdate,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentPrimary,
                      foregroundColor: AppColors.bgPage,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPage),
                          )
                        : const Text('Save & Continue', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
