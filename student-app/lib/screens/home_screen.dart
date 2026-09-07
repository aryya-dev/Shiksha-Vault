import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/supabase_service.dart';
import '../models/subject.dart';
import '../models/student.dart';
import 'folder_browser_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<SubjectModel> _subjects = [];
  StudentModel? _studentProfile;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final profile = await SupabaseService.getStudentProfile();
      final subs = await SupabaseService.getEnrolledSubjects();
      
      if (mounted) {
        setState(() {
          _studentProfile = profile;
          _subjects = subs;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('[HomeScreen] Load error: $e');
      if (mounted) {
        final errStr = e.toString().toLowerCase();
        String friendly;
        if (errStr.contains('socket') ||
            errStr.contains('network') ||
            errStr.contains('failed host lookup') ||
            errStr.contains('connection') ||
            errStr.contains('clientexception')) {
          friendly = 'Could not connect to institute server.\nPlease check your mobile data or Wi-Fi connection.';
        } else {
          friendly = 'Unable to load your subjects right now.\nPlease tap Try Again.';
        }

        setState(() {
          _errorMessage = friendly;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleLogout() async {
    await Supabase.instance.client.auth.signOut();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.only(left: 14, top: 10, bottom: 10),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.all(2),
            child: Image.asset(
              'assets/images/shiksharthi_icon.png',
              fit: BoxFit.contain,
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enrolled Subjects',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
            if (_studentProfile != null)
              Text(
                '${_studentProfile!.fullName} (${_studentProfile!.studentCode})',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary, size: 20),
            onPressed: _handleLogout,
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accentPrimary),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off_rounded, size: 52, color: AppColors.warning),
                        const SizedBox(height: 18),
                        const Text(
                          'Connection Problem',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _loadData,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentPrimary,
                            foregroundColor: const Color(0xFF0E0E10),
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Try Again', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ),
                )
              : _subjects.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inbox_outlined, size: 48, color: AppColors.textMuted),
                            SizedBox(height: 16),
                            Text(
                              'No Enrolled Subjects',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                            ),
                            SizedBox(height: 6),
                            Text(
                              'You are not enrolled in any active subjects. Please speak with the administration.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    )
              : RefreshIndicator(
                  color: AppColors.accentPrimary,
                  backgroundColor: AppColors.surfaceRaised,
                  onRefresh: _loadData,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                    itemCount: _subjects.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final subject = _subjects[index];
                      final subjectColor = AppColors.getSubjectColor(subject.slug);

                      return InkWell(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => FolderBrowserScreen(
                                subject: subject,
                                studentProfile: _studentProfile,
                              ),
                            ),
                          );
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppColors.surfaceCard,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: IntrinsicHeight(
                            child: Row(
                              children: [
                                // Functional subject left spine
                                Container(
                                  width: 6,
                                  decoration: BoxDecoration(
                                    color: subjectColor,
                                    borderRadius: const BorderRadius.only(
                                      topLeft: Radius.circular(8),
                                      bottomLeft: Radius.circular(8),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                    child: Row(
                                      children: [
                                        Icon(Icons.menu_book_rounded, color: subjectColor, size: 22),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Text(
                                            subject.name,
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w500,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                        const Icon(
                                          Icons.chevron_right_rounded,
                                          color: AppColors.textMuted,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
