class FolderModel {
  final String id;
  final String? batchId;
  final String subjectId;
  final String name;
  final String? parentFolderId;
  final int sortOrder;
  final bool isDeleted;

  FolderModel({
    required this.id,
    this.batchId,
    required this.subjectId,
    required this.name,
    this.parentFolderId,
    required this.sortOrder,
    this.isDeleted = false,
  });

  factory FolderModel.fromJson(Map<String, dynamic> json) {
    return FolderModel(
      id: json['id'] as String,
      batchId: json['batch_id'] as String?,
      subjectId: json['subject_id'] as String,
      name: json['name'] as String,
      parentFolderId: json['parent_folder_id'] as String?,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      isDeleted: json['is_deleted'] as bool? ?? false,
    );
  }
}
