class FileItemModel {
  final String id;
  final String folderId;
  final String name;
  final String storagePath;
  final int version;
  final int? fileSizeBytes;
  final DateTime uploadedAt;
  final bool isDeleted;

  FileItemModel({
    required this.id,
    required this.folderId,
    required this.name,
    required this.storagePath,
    required this.version,
    this.fileSizeBytes,
    required this.uploadedAt,
    this.isDeleted = false,
  });

  factory FileItemModel.fromJson(Map<String, dynamic> json) {
    return FileItemModel(
      id: json['id'] as String,
      folderId: json['folder_id'] as String,
      name: json['name'] as String,
      storagePath: json['storage_path'] as String,
      version: (json['version'] as num?)?.toInt() ?? 1,
      fileSizeBytes: (json['file_size_bytes'] as num?)?.toInt(),
      uploadedAt: json['uploaded_at'] != null 
          ? DateTime.parse(json['uploaded_at'] as String) 
          : DateTime.now(),
      isDeleted: json['is_deleted'] as bool? ?? false,
    );
  }
}
