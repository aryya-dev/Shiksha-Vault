class FileItemModel {
  final String id;
  final String folderId;
  final String name;
  final String storagePath;
  final String storageProvider;
  final String? gdriveFileId;
  final int version;
  final int? fileSizeBytes;
  final String fileType;
  final DateTime uploadedAt;
  final bool isDeleted;

  FileItemModel({
    required this.id,
    required this.folderId,
    required this.name,
    required this.storagePath,
    this.storageProvider = 'supabase',
    this.gdriveFileId,
    required this.version,
    this.fileSizeBytes,
    this.fileType = 'application/pdf',
    required this.uploadedAt,
    this.isDeleted = false,
  });

  factory FileItemModel.fromJson(Map<String, dynamic> json) {
    final rawPath = json['storage_path'] as String? ?? '';
    final rawProvider = json['storage_provider'] as String?;
    final isDrive = rawProvider == 'gdrive' || rawPath.startsWith('gdrive:');

    return FileItemModel(
      id: json['id'] as String,
      folderId: json['folder_id'] as String,
      name: json['name'] as String,
      storagePath: rawPath,
      storageProvider: isDrive ? 'gdrive' : (rawProvider ?? 'supabase'),
      gdriveFileId: json['gdrive_file_id'] as String? ?? 
          (rawPath.startsWith('gdrive:') ? rawPath.replaceFirst('gdrive:', '') : null),
      version: (json['version'] as num?)?.toInt() ?? 1,
      fileSizeBytes: (json['file_size_bytes'] as num?)?.toInt(),
      fileType: json['file_type'] as String? ?? 'application/pdf',
      uploadedAt: json['uploaded_at'] != null 
          ? DateTime.parse(json['uploaded_at'] as String) 
          : DateTime.now(),
      isDeleted: json['is_deleted'] as bool? ?? false,
    );
  }
}

