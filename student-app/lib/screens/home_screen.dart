import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/supabase_service.dart';
import '../models/subject.dart';
import '../models/batch.dart';
import '../models/folder.dart';
import '../models/student.dart';
import 'folder_browser_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<BatchModel> _batches = [];
  BatchModel? _selectedBatch;

  List<SubjectModel> _subjects = [];
  List<FolderModel> _foundationFolders = [];

  StudentModel? _studentProfile;
  bool _isLoading = true;
  bool _isLoadingFoundation = false;
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
      final batches = await SupabaseService.getStudentBatches(
        studentId: profile?.id,
        primaryBatchId: profile?.batchId,
      );

      BatchModel? activeBatch;
      if (batches.isNotEmpty) {
        // Keep current selected if valid, else default to primary (or first non-foundation)
        activeBatch = _selectedBatch != null && batches.any((b) => b.id == _selectedBatch!.id)
            ? _selectedBatch
            : batches.first;
      }

      List<SubjectModel> subs = [];
      List<FolderModel> fFolders = [];

      if (activeBatch != null && activeBatch.isFoundation) {
        try {
          fFolders = await SupabaseService.getFolders(batchId: activeBatch.id);
        } catch (fErr) {
          debugPrint('[HomeScreen] Foundation folder load error: $fErr');
          fFolders = [];
        }
      } else {
        try {
          final allSubs = await SupabaseService.getEnrolledSubjects();
          subs = allSubs
              .where((s) => s.slug != 'foundation-batch' && !s.name.toLowerCase().contains('foundation'))
              .toList();
        } catch (sErr) {
          debugPrint('[HomeScreen] Enrolled subjects load error: $sErr');
          subs = [];
        }
      }

      if (mounted) {
        setState(() {
          _studentProfile = profile;
          _batches = batches;
          _selectedBatch = activeBatch;
          _subjects = subs;
          _foundationFolders = fFolders;
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
          friendly = 'Unable to load study materials right now.\nPlease tap Try Again.';
        }

        setState(() {
          _errorMessage = friendly;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _onSelectBatch(BatchModel batch) async {
    if (_selectedBatch?.id == batch.id) return;

    setState(() {
      _selectedBatch = batch;
    });

    if (batch.isFoundation) {
      setState(() => _isLoadingFoundation = true);
      try {
        final folders = await SupabaseService.getFolders(batchId: batch.id);
        if (mounted) {
          setState(() {
            _foundationFolders = folders;
            _isLoadingFoundation = false;
          });
        }
      } catch (e) {
        debugPrint('[HomeScreen] Error loading foundation folders: $e');
        if (mounted) {
          setState(() {
            _foundationFolders = [];
            _isLoadingFoundation = false;
          });
        }
      }
    } else {
      if (_subjects.isEmpty) {
        try {
          final allSubs = await SupabaseService.getEnrolledSubjects();
          final subs = allSubs
              .where((s) => s.slug != 'foundation-batch' && !s.name.toLowerCase().contains('foundation'))
              .toList();
          if (mounted) {
            setState(() => _subjects = subs);
          }
        } catch (e) {
          debugPrint('[HomeScreen] Error loading subjects: $e');
        }
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
    final isFoundationActive = _selectedBatch?.isFoundation ?? false;

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
              'Shiksharthi',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
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
              : RefreshIndicator(
                  color: AppColors.accentPrimary,
                  backgroundColor: AppColors.surfaceRaised,
                  onRefresh: _loadData,
                  child: Column(
                    children: [
                      // 1. BATCH SWITCHER (Displayed if student has multiple batches)
                      if (_batches.length > 1) _buildBatchSwitcher(),

                      // 2. MAIN CONTENT AREA
                      Expanded(
                        child: isFoundationActive
                            ? _buildFoundationContent()
                            : _buildSubjectsContent(),
                      ),
                    ],
                  ),
                ),
    );
  }

  /// Interactive Batch Switcher Segmented Control
  Widget _buildBatchSwitcher() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: _batches.map((batch) {
          final isSelected = _selectedBatch?.id == batch.id;
          final isFoundation = batch.isFoundation;

          return Expanded(
            child: GestureDetector(
              onTap: () => _onSelectBatch(batch),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isFoundation ? const Color(0xFF2E1C0A) : AppColors.surfaceCard)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(7),
                  border: isSelected
                      ? Border.all(
                          color: isFoundation ? const Color(0xFFFF9F1C) : AppColors.accentPrimary,
                          width: 1.2,
                        )
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (isFoundation) ...[
                      const Text('⚡ ', style: TextStyle(fontSize: 12)),
                    ],
                    Flexible(
                      child: Text(
                        isFoundation ? 'Foundation' : batch.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                          color: isSelected
                              ? (isFoundation ? const Color(0xFFFF9F1C) : AppColors.accentPrimary)
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  /// Content view for regular school batch subjects
  Widget _buildSubjectsContent() {
    if (_subjects.isEmpty) {
      return const Center(
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
                'You are not enrolled in any active subjects for this batch. Please speak with the administration.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                  batch: _selectedBatch,
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
    );
  }

  /// Content view for Foundation Batch (direct folders & files without subjects)
  Widget _buildFoundationContent() {
    if (_isLoadingFoundation) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFFF9F1C)),
      );
    }

    const foundationColor = Color(0xFFFF9F1C);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [

        if (_foundationFolders.isEmpty) ...[
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40.0),
              child: Column(
                children: [
                  Icon(Icons.folder_open_rounded, size: 48, color: AppColors.textMuted),
                  SizedBox(height: 12),
                  Text(
                    'No Foundation Folders Yet',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Foundation course materials will appear here once uploaded by faculty.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
        ] else ...[
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'COURSE FOLDERS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
                letterSpacing: 0.5,
              ),
            ),
          ),
          ..._foundationFolders.map((folder) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: AppColors.surfaceCard,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: ListTile(
                leading: const Icon(Icons.folder_rounded, color: foundationColor, size: 24),
                title: Text(
                  folder.name,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                ),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => FolderBrowserScreen(
                        batch: _selectedBatch,
                        parentFolder: folder,
                        studentProfile: _studentProfile,
                      ),
                    ),
                  );
                },
              ),
            );
          }),
        ],
      ],
    );
  }
}

extension ListFilter<T> on List<T> {
  Iterable<T> filter(bool Function(T) test) sync* {
    for (var element in this) {
      if (test(element)) {
        yield element;
      }
    }
  }
}
