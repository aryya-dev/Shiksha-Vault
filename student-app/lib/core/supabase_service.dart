import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/subject.dart';
import '../models/batch.dart';
import '../models/folder.dart';
import '../models/file_item.dart';
import '../models/student.dart';

class SupabaseService {
  static final SupabaseClient client = Supabase.instance.client;

  /// Fetch currently authenticated student profile
  static Future<StudentModel?> getStudentProfile() async {
    final user = client.auth.currentUser;
    if (user == null) return null;

    final response = await client
        .from('students')
        .select()
        .eq('id', user.id)
        .single();

    return StudentModel.fromJson(response);
  }

  /// Fetch all batches this student is enrolled in (primary batch + any secondary batches)
  static Future<List<BatchModel>> getStudentBatches({String? studentId, String? primaryBatchId}) async {
    final user = client.auth.currentUser;
    final targetStudentId = studentId ?? user?.id;
    final List<BatchModel> batches = [];
    final Set<String> seenIds = {};

    // 1. Fetch primary batch
    if (primaryBatchId != null) {
      try {
        final bRes = await client
            .from('batches')
            .select()
            .eq('id', primaryBatchId)
            .maybeSingle();
        if (bRes != null) {
          final b = BatchModel.fromJson(bRes);
          batches.add(b);
          seenIds.add(b.id);
        }
      } catch (e) {
        debugPrint('[SupabaseService] Error loading primary batch: $e');
      }
    }

    // 2. Fetch secondary batches from student_batches
    if (targetStudentId != null) {
      try {
        final sbRes = await client
            .from('student_batches')
            .select('batch_id, batches (*)')
            .eq('student_id', targetStudentId);

        for (final row in (sbRes as List)) {
          final batchData = row['batches'];
          if (batchData != null && batchData is Map<String, dynamic>) {
            final b = BatchModel.fromJson(batchData);
            if (!seenIds.contains(b.id)) {
              batches.add(b);
              seenIds.add(b.id);
            }
          } else if (row['batch_id'] != null) {
            // Direct query fallback if joined batches was null
            try {
              final directB = await client
                  .from('batches')
                  .select()
                  .eq('id', row['batch_id'])
                  .maybeSingle();
              if (directB != null) {
                final b = BatchModel.fromJson(directB);
                if (!seenIds.contains(b.id)) {
                  batches.add(b);
                  seenIds.add(b.id);
                }
              }
            } catch (e2) {
              debugPrint('[SupabaseService] Error loading direct secondary batch: $e2');
            }
          }
        }
      } catch (e) {
        debugPrint('[SupabaseService] Error loading secondary batches: $e');
      }
    }

    return batches;
  }

  /// Fetch only subjects this student is enrolled in (enforced via Postgres RLS)
  static Future<List<SubjectModel>> getEnrolledSubjects() async {
    final response = await client
        .from('subjects')
        .select('id, name, slug, color')
        .order('name');

    return (response as List).map((e) => SubjectModel.fromJson(e)).toList();
  }

  /// Fetch non-deleted folders for a subject OR direct batch folders (enforced via RLS)
  static Future<List<FolderModel>> getFolders({
    String? subjectId,
    String? parentFolderId,
    String? batchId,
  }) async {
    try {
      var query = client
          .from('folders')
          .select()
          .eq('is_deleted', false);

      if (batchId != null) {
        query = query.eq('batch_id', batchId);
      }

      if (subjectId != null) {
        query = query.eq('subject_id', subjectId);
      }

      if (parentFolderId == null) {
        query = query.filter('parent_folder_id', 'is', null);
      } else {
        query = query.eq('parent_folder_id', parentFolderId);
      }

      final response = await query.order('sort_order', ascending: true);
      return (response as List).map((e) => FolderModel.fromJson(e)).toList();
    } catch (e) {
      debugPrint('[SupabaseService] getFolders error: $e, attempting fallback query...');
      try {
        var fbQuery = client
            .from('folders')
            .select()
            .eq('is_deleted', false);
        if (batchId != null) {
          fbQuery = fbQuery.eq('batch_id', batchId);
        }
        if (subjectId != null) {
          fbQuery = fbQuery.eq('subject_id', subjectId);
        }
        final fbRes = await fbQuery.order('sort_order', ascending: true);
        final list = (fbRes as List).map((e) => FolderModel.fromJson(e)).toList();
        if (parentFolderId == null) {
          return list.where((f) => f.parentFolderId == null || f.parentFolderId!.isEmpty).toList();
        } else {
          return list.where((f) => f.parentFolderId == parentFolderId).toList();
        }
      } catch (fbErr) {
        debugPrint('[SupabaseService] Fallback getFolders error: $fbErr');
        rethrow;
      }
    }
  }

  /// Fetch non-deleted files for a folder (enforced via RLS)
  static Future<List<FileItemModel>> getFiles(String folderId) async {
    final response = await client
        .from('files')
        .select()
        .eq('folder_id', folderId)
        .eq('is_deleted', false)
        .order('name', ascending: true);

    return (response as List).map((e) => FileItemModel.fromJson(e)).toList();
  }

  /// Request short-lived signed URL (expires in 300 seconds) for private storage PDF
  static Future<String?> getSignedFileUrl(String storagePath) async {
    try {
      final signedUrl = await client.storage
          .from('course-materials')
          .createSignedUrl(storagePath, 300); // 5 minutes ephemeral access
      return signedUrl;
    } catch (e) {
      debugPrint('[SupabaseService] Error creating signed URL: $e');
      return null;
    }
  }

  /// Download private storage PDF binary directly into memory (zero-disk anti-leak)
  static Future<Uint8List> downloadFile(String storagePath) async {
    return await client.storage
        .from('course-materials')
        .download(storagePath);
  }

  /// Log access and leak interception events
  static Future<void> logAccessEvent({
    required String fileId,
    required String eventType,
    Map<String, dynamic>? metadata,
  }) async {
    final user = client.auth.currentUser;
    if (user == null) return;

    try {
      await client.from('access_logs').insert({
        'student_id': user.id,
        'file_id': fileId,
        'event_type': eventType,
        'metadata': metadata ?? {},
      });
    } catch (e) {
      debugPrint('[SupabaseService] Error logging access event: $e');
    }
  }
}
