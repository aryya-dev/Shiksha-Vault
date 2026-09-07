import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/subject.dart';
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

  /// Fetch only subjects this student is enrolled in (enforced via Postgres RLS)
  static Future<List<SubjectModel>> getEnrolledSubjects() async {
    final response = await client
        .from('subjects')
        .select('id, name, slug, color')
        .order('name');

    return (response as List).map((e) => SubjectModel.fromJson(e)).toList();
  }

  /// Fetch non-deleted folders for a specific subject and batch (enforced via RLS)
  static Future<List<FolderModel>> getFolders(
    String subjectId, {
    String? parentFolderId,
    String? batchId,
  }) async {
    var query = client
        .from('folders')
        .select()
        .eq('subject_id', subjectId)
        .eq('is_deleted', false);

    if (batchId != null) {
      query = query.or('batch_id.eq.$batchId,batch_id.is.null');
    }

    if (parentFolderId == null) {
      query = query.filter('parent_folder_id', 'is', null);
    } else {
      query = query.eq('parent_folder_id', parentFolderId);
    }

    final response = await query.order('sort_order', ascending: true);
    return (response as List).map((e) => FolderModel.fromJson(e)).toList();
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
