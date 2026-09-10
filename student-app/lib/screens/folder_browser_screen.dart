import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/supabase_service.dart';
import '../models/subject.dart';
import '../models/folder.dart';
import '../models/file_item.dart';
import '../models/student.dart';
import 'secure_pdf_viewer_screen.dart';

class FolderBrowserScreen extends StatefulWidget {
  final SubjectModel subject;
  final FolderModel? parentFolder;
  final StudentModel? studentProfile;

  const FolderBrowserScreen({
    super.key,
    required this.subject,
    this.parentFolder,
    this.studentProfile,
  });

  @override
  State<FolderBrowserScreen> createState() => _FolderBrowserScreenState();
}

class _FolderBrowserScreenState extends State<FolderBrowserScreen> {
  List<FolderModel> _folders = [];
  List<FileItemModel> _files = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final folders = await SupabaseService.getFolders(
        widget.subject.id,
        parentFolderId: widget.parentFolder?.id,
        batchId: widget.studentProfile?.batchId,
      );

      List<FileItemModel> files = [];
      if (widget.parentFolder != null) {
        files = await SupabaseService.getFiles(widget.parentFolder!.id);
      }

      if (mounted) {
        setState(() {
          _folders = folders;
          _files = files;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('[FolderBrowserScreen] Load error: $e');
      if (mounted) {
        final errStr = e.toString().toLowerCase();
        String friendly;
        if (errStr.contains('socket') ||
            errStr.contains('network') ||
            errStr.contains('failed host lookup') ||
            errStr.contains('connection') ||
            errStr.contains('clientexception')) {
          friendly = 'Could not reach institute server.\nPlease check your mobile data or Wi-Fi connection.';
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

  String _formatBytes(int? bytes) {
    if (bytes == null || bytes <= 0) return 'PDF';
    final mb = bytes / (1024 * 1024);
    return '${mb.toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.parentFolder?.name ?? widget.subject.name;
    final subjectColor = AppColors.getSubjectColor(widget.subject.slug);

    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        title: Text(
          title,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accentPrimary))
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
                          onPressed: _loadContent,
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
              : _folders.isEmpty && _files.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.folder_open_outlined, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 16),
                        Text(
                          'No files yet — your teacher hasn\'t added anything for ${widget.subject.name}.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.accentPrimary,
                  backgroundColor: AppColors.surfaceRaised,
                  onRefresh: _loadContent,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    children: [
                      // Sub-folders Section
                      if (_folders.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.only(left: 4, bottom: 8),
                          child: Text(
                            'FOLDERS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        ..._folders.map((folder) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceCard,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: ListTile(
                                leading: Icon(Icons.folder_rounded, color: subjectColor, size: 22),
                                title: Text(
                                  folder.name,
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                                ),
                                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => FolderBrowserScreen(
                                        subject: widget.subject,
                                        parentFolder: folder,
                                        studentProfile: widget.studentProfile,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            )),
                        const SizedBox(height: 16),
                      ],

                      // Documents / Files Section
                      if (_files.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.only(left: 4, bottom: 8),
                          child: Text(
                            'DOCUMENTS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        ..._files.map((file) {
                          final type = file.fileType.toLowerCase();
                          final name = file.name.toLowerCase();

                          IconData fileIcon = Icons.picture_as_pdf_rounded;
                          Color fileColor = AppColors.danger;
                          String formatLabel = 'PDF';

                          if (type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.mkv') || name.endsWith('.webm')) {
                            fileIcon = Icons.play_circle_fill_rounded;
                            fileColor = const Color(0xFFA855F7); // Purple
                            formatLabel = 'Video';
                          } else if (type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.gif')) {
                            fileIcon = Icons.image_rounded;
                            fileColor = const Color(0xFF10B981); // Emerald Green
                            formatLabel = 'Image';
                          }

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: ListTile(
                              leading: Icon(fileIcon, color: fileColor, size: 22),
                              title: Text(
                                file.name,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                              ),
                              subtitle: Text(
                                '$formatLabel • v${file.version} • ${_formatBytes(file.fileSizeBytes)}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                              trailing: const Icon(Icons.remove_red_eye_outlined, color: AppColors.accentPrimary, size: 18),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => SecurePdfViewerScreen(
                                      file: file,
                                      studentProfile: widget.studentProfile,
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
    );
  }
}
