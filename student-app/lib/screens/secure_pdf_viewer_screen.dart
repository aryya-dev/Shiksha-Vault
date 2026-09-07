import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/security_service.dart';
import '../core/supabase_service.dart';
import '../models/file_item.dart';
import '../models/student.dart';

class SecurePdfViewerScreen extends StatefulWidget {
  final FileItemModel file;
  final StudentModel? studentProfile;

  const SecurePdfViewerScreen({
    super.key,
    required this.file,
    this.studentProfile,
  });

  @override
  State<SecurePdfViewerScreen> createState() => _SecurePdfViewerScreenState();
}

class _SecurePdfViewerScreenState extends State<SecurePdfViewerScreen> with WidgetsBindingObserver {
  Uint8List? _pdfBytes;
  bool _isLoading = true;
  String? _errorTitle;
  String? _errorMessage;
  IconData _errorIcon = Icons.info_outline_rounded;
  int _totalPages = 0;
  int _currentPage = 0;
  final bool _isScreenRecording = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // 1. Activate Android FLAG_SECURE
    SecurityService.enableScreenProtection();
    // 2. Fetch encrypted PDF binary directly into memory
    _loadPdf();
    // 3. Log access event
    SupabaseService.logAccessEvent(
      fileId: widget.file.id,
      eventType: 'view_file',
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    SecurityService.disableScreenProtection();
    super.dispose();
  }

  Future<void> _loadPdf() async {
    setState(() {
      _isLoading = true;
      _errorTitle = null;
      _errorMessage = null;
    });

    try {
      final bytes = await SupabaseService.downloadFile(widget.file.storagePath);
      if (mounted) {
        if (bytes.isNotEmpty) {
          setState(() {
            _pdfBytes = bytes;
            _isLoading = false;
          });
        } else {
          setState(() {
            _isLoading = false;
            _errorIcon = Icons.description_outlined;
            _errorTitle = 'Document Is Empty';
            _errorMessage = 'The requested file contains no readable content. Please notify your faculty.';
          });
        }
      }
    } on StorageException catch (e) {
      debugPrint('[SecurePdfViewer] StorageException: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          final msg = e.message.toLowerCase();
          final isNotFound = e.statusCode == '404' ||
              e.error == 'not_found' ||
              msg.contains('object not found') ||
              msg.contains('nosuchkey') ||
              msg.contains('"statuscode":"404"');
          final isForbidden = e.statusCode == '403' ||
              msg.contains('row-level security') ||
              msg.contains('accessdenied') ||
              msg.contains('unauthorized');

          if (isNotFound) {
            _errorIcon = Icons.cloud_off_rounded;
            _errorTitle = 'Document Not Ready Yet';
            _errorMessage = 'This study material has not been uploaded by your institute faculty yet.\nPlease check back shortly or inform your teacher.';
          } else if (isForbidden) {
            _errorIcon = Icons.lock_outline_rounded;
            _errorTitle = 'Access Restricted';
            _errorMessage = 'You do not have access to this document.\nPlease check with your faculty to ensure you are enrolled in this batch.';
          } else {
            _errorIcon = Icons.cloud_queue_rounded;
            _errorTitle = 'Document Server Busy';
            _errorMessage = 'Could not load this document right now. Please tap Try Again in a moment.';
          }
        });
      }
    } catch (e) {
      debugPrint('[SecurePdfViewer] Error loading PDF: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          final errStr = e.toString().toLowerCase();
          if (errStr.contains('socket') ||
              errStr.contains('network') ||
              errStr.contains('connection') ||
              errStr.contains('failed host lookup') ||
              errStr.contains('clientexception') ||
              errStr.contains('timeout')) {
            _errorIcon = Icons.wifi_off_rounded;
            _errorTitle = 'No Internet Connection';
            _errorMessage = 'Could not reach the institute server.\nPlease check your mobile data or Wi-Fi connection and tap Try Again.';
          } else {
            _errorIcon = Icons.description_outlined;
            _errorTitle = 'Unable to Open Document';
            _errorMessage = 'An unexpected issue occurred while loading this PDF.\nPlease tap Try Again.';
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final studentName = widget.studentProfile?.fullName ?? 'Enrolled Student';
    final studentCode = widget.studentProfile?.studentCode ?? 'SHIKSHA-STUDENT';
    final timestamp = DateFormat('dd MMM yyyy HH:mm').format(DateTime.now());
    final watermarkText = '$studentName  •  $studentCode  •  $timestamp';

    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        backgroundColor: AppColors.bgPage,
        elevation: 0,
        title: Text(
          widget.file.name,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (_totalPages > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16.0),
                child: Text(
                  '${_currentPage + 1} / $_totalPages',
                  style: const TextStyle(
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          // PDF Rendering Body
          if (_isLoading)
            const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppColors.accentPrimary),
                  SizedBox(height: 16),
                  Text(
                    'Loading document securely...',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            )
          else if (_errorMessage != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceRaised,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Icon(_errorIcon, color: AppColors.accentPrimary, size: 34),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      _errorTitle ?? 'Document Unavailable',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _loadPdf,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Try Again'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceCard,
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else if (_pdfBytes != null)
            PDFView(
              pdfData: _pdfBytes,
              enableSwipe: true,
              swipeHorizontal: false,
              autoSpacing: true,
              pageFling: true,
              onRender: (pages) {
                setState(() => _totalPages = pages ?? 0);
              },
              onPageChanged: (page, total) {
                setState(() {
                  _currentPage = page ?? 0;
                  _totalPages = total ?? 0;
                });
              },
            ),

          // Dynamic Semi-Transparent Traceable Watermark Overlay
          IgnorePointer(
            child: SizedBox.expand(
              child: CustomPaint(
                painter: WatermarkPainter(watermarkText: watermarkText),
              ),
            ),
          ),

          // iOS Screen recording protection blur / blackout overlay
          if (_isScreenRecording)
            Container(
              color: Colors.black,
              child: const Center(
                child: Text(
                  'Content hidden during screen recording',
                  style: TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Custom painter for repetitive diagonal tiled watermark
class WatermarkPainter extends CustomPainter {
  final String watermarkText;

  WatermarkPainter({required this.watermarkText});

  @override
  void paint(Canvas canvas, Size size) {
    const double stepX = 260;
    const double stepY = 160;

    final textStyle = TextStyle(
      color: Colors.white.withOpacity(0.08), // Subtle, visible on dark / white pages
      fontSize: 12,
      fontWeight: FontWeight.w500,
      letterSpacing: 0.5,
    );

    final textSpan = TextSpan(text: watermarkText, style: textStyle);
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: ui.TextDirection.ltr,
    )..layout();

    for (double x = -100; x < size.width + 100; x += stepX) {
      for (double y = -50; y < size.height + 50; y += stepY) {
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(-0.35); // Slight diagonal tilt
        textPainter.paint(canvas, Offset.zero);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
