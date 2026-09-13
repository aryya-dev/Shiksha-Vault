import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';
import '../core/theme.dart';
import '../core/security_service.dart';
import '../core/supabase_service.dart';
import '../models/file_item.dart';
import '../models/student.dart';
import 'secure_pdf_viewer_screen.dart'; // For WatermarkPainter

class SecureVideoPlayerScreen extends StatefulWidget {
  final FileItemModel file;
  final StudentModel? studentProfile;

  const SecureVideoPlayerScreen({
    super.key,
    required this.file,
    this.studentProfile,
  });

  @override
  State<SecureVideoPlayerScreen> createState() => _SecureVideoPlayerScreenState();
}

class _SecureVideoPlayerScreenState extends State<SecureVideoPlayerScreen> with WidgetsBindingObserver {
  VideoPlayerController? _controller;
  bool _isLoading = true;
  String? _errorMessage;
  bool _showControls = true;
  Timer? _hideControlsTimer;
  bool _isFullscreen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // 1. Enable screenshot and screen capture prevention
    SecurityService.enableScreenProtection();
    // 2. Initialize video stream
    _initVideo();
    // 3. Log access event
    SupabaseService.logAccessEvent(
      fileId: widget.file.id,
      eventType: 'view_video',
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _hideControlsTimer?.cancel();
    _controller?.dispose();
    // Restore portrait orientation and UI overlays if in fullscreen
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SecurityService.disableScreenProtection();
    super.dispose();
  }

  Future<void> _initVideo() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // 1. Generate a secure, 1-hour signed URL from private course-materials storage
      final signedUrl = await SupabaseService.getSignedFileUrl(widget.file.storagePath, expiresIn: 3600);
      if (signedUrl == null || signedUrl.isEmpty) {
        throw 'Unable to authorize secure video stream. Please check your network or permissions.';
      }

      // 2. Initialize video player with the signed streaming URL
      final controller = VideoPlayerController.networkUrl(
        Uri.parse(signedUrl),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
      );

      await controller.initialize();
      controller.addListener(_videoListener);

      if (mounted) {
        setState(() {
          _controller = controller;
          _isLoading = false;
        });
        controller.play();
        _startHideControlsTimer();
      }
    } catch (e) {
      debugPrint('[SecureVideoPlayer] Error loading video: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Could not play this video lesson.\nPlease ensure you have an active network connection and try again.';
        });
      }
    }
  }

  void _videoListener() {
    if (mounted) {
      setState(() {});
    }
  }

  void _togglePlayPause() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    setState(() {
      if (_controller!.value.isPlaying) {
        _controller!.pause();
        _showControls = true;
        _hideControlsTimer?.cancel();
      } else {
        _controller!.play();
        _startHideControlsTimer();
      }
    });
  }

  void _seekRelative(int seconds) {
    if (_controller == null || !_controller!.value.isInitialized) return;
    final current = _controller!.value.position;
    final target = current + Duration(seconds: seconds);
    final total = _controller!.value.duration;

    if (target < Duration.zero) {
      _controller!.seekTo(Duration.zero);
    } else if (target > total) {
      _controller!.seekTo(total);
    } else {
      _controller!.seekTo(target);
    }
    _startHideControlsTimer();
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls && (_controller?.value.isPlaying ?? false)) {
      _startHideControlsTimer();
    } else {
      _hideControlsTimer?.cancel();
    }
  }

  void _startHideControlsTimer() {
    _hideControlsTimer?.cancel();
    _hideControlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && (_controller?.value.isPlaying ?? false)) {
        setState(() => _showControls = false);
      }
    });
  }

  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
      if (_isFullscreen) {
        SystemChrome.setPreferredOrientations([
          DeviceOrientation.landscapeLeft,
          DeviceOrientation.landscapeRight,
        ]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      } else {
        SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      }
    });
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final studentName = widget.studentProfile?.fullName ?? 'Enrolled Student';
    final studentCode = widget.studentProfile?.studentCode ?? 'SHIKSHA-STUDENT';
    final timestamp = DateFormat('dd MMM yyyy HH:mm').format(DateTime.now());

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (_isFullscreen) {
          _toggleFullscreen();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: _isFullscreen
            ? null
            : AppBar(
                backgroundColor: const Color(0xFF0E0E10),
                elevation: 0,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                title: Text(
                  widget.file.name,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
        body: Stack(
          fit: StackFit.expand,
          children: [
            // 1. VIDEO RENDERING OR LOADING / ERROR
            if (_isLoading)
              const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppColors.accentPrimary),
                    SizedBox(height: 16),
                    Text(
                      'Loading video lesson securely...',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
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
                          color: const Color(0xFF1E293B),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24),
                        ),
                        child: const Icon(Icons.videocam_off_rounded, color: AppColors.danger, size: 34),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Unable to Play Video',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _initVideo,
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Try Again'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E293B),
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white24),
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else if (_controller != null && _controller!.value.isInitialized)
              GestureDetector(
                onTap: _toggleControls,
                behavior: HitTestBehavior.opaque,
                child: Center(
                  child: AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio,
                    child: VideoPlayer(_controller!),
                  ),
                ),
              ),

            // 2. WATERMARK OVERLAY (Constant faint diagonal "Shiksharthi" protection across video)
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: WatermarkPainter(
                    studentName: studentName,
                    studentCode: studentCode,
                    timestamp: timestamp,
                  ),
                ),
              ),
            ),

            // 3. BUFFERING INDICATOR
            if (_controller != null && _controller!.value.isBuffering)
              const Center(
                child: CircularProgressIndicator(color: AppColors.accentPrimary),
              ),

            // 4. PLAYER CONTROLS OVERLAY
            if (_controller != null && _controller!.value.isInitialized && _showControls)
              GestureDetector(
                onTap: _toggleControls,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  color: Colors.black45,
                  child: Stack(
                    children: [
                      // Center Play/Pause & Quick Seek Buttons
                      Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            IconButton(
                              iconSize: 36,
                              icon: const Icon(Icons.replay_10_rounded, color: Colors.white),
                              onPressed: () => _seekRelative(-10),
                            ),
                            const SizedBox(width: 24),
                            Container(
                              decoration: const BoxDecoration(
                                color: AppColors.accentPrimary,
                                shape: BoxShape.circle,
                              ),
                              child: IconButton(
                                iconSize: 42,
                                icon: Icon(
                                  _controller!.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                  color: const Color(0xFF0E0E10),
                                ),
                                onPressed: _togglePlayPause,
                              ),
                            ),
                            const SizedBox(width: 24),
                            IconButton(
                              iconSize: 36,
                              icon: const Icon(Icons.forward_10_rounded, color: Colors.white),
                              onPressed: () => _seekRelative(10),
                            ),
                          ],
                        ),
                      ),

                      // Top Navigation Bar (in Fullscreen mode)
                      if (_isFullscreen)
                        Positioned(
                          top: 16,
                          left: 16,
                          right: 16,
                          child: Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                                onPressed: _toggleFullscreen,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  widget.file.name,
                                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Bottom Progress Slider & Time
                      Positioned(
                        bottom: _isFullscreen ? 24 : 12,
                        left: 16,
                        right: 16,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Scrubber
                            SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                trackHeight: 3,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                                activeTrackColor: AppColors.accentPrimary,
                                inactiveTrackColor: Colors.white24,
                                thumbColor: AppColors.accentPrimary,
                              ),
                              child: Slider(
                                min: 0.0,
                                max: _controller!.value.duration.inMilliseconds.toDouble(),
                                value: _controller!.value.position.inMilliseconds
                                    .clamp(0, _controller!.value.duration.inMilliseconds)
                                    .toDouble(),
                                onChanged: (value) {
                                  _controller!.seekTo(Duration(milliseconds: value.toInt()));
                                  _startHideControlsTimer();
                                },
                              ),
                            ),
                            // Time row & Fullscreen Toggle
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${_formatDuration(_controller!.value.position)} / ${_formatDuration(_controller!.value.duration)}',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                                      color: Colors.white,
                                      size: 24,
                                    ),
                                    onPressed: _toggleFullscreen,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // 5. SECURITY BADGE (Only in non-fullscreen or when controls visible)
            if (!_isFullscreen && !_showControls)
              Positioned(
                bottom: 16,
                left: 24,
                right: 24,
                child: IgnorePointer(
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xDD0E0E10),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield_outlined, color: AppColors.accentPrimary, size: 14),
                          SizedBox(width: 8),
                          Text(
                            'Protected Video • Screen Capture Prohibited',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
