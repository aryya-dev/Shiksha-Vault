class StudentModel {
  final String id;
  final String studentCode;
  final String fullName;
  final String? batchId;
  final String? className;
  final String? board;
  final bool isActive;
  final bool mustChangePassword;

  StudentModel({
    required this.id,
    required this.studentCode,
    required this.fullName,
    this.batchId,
    this.className,
    this.board,
    required this.isActive,
    required this.mustChangePassword,
  });

  factory StudentModel.fromJson(Map<String, dynamic> json) {
    return StudentModel(
      id: json['id'] as String,
      studentCode: json['student_code'] as String,
      fullName: json['full_name'] as String,
      batchId: json['batch_id'] as String?,
      className: json['class_name'] as String?,
      board: json['board'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      mustChangePassword: json['must_change_password'] as bool? ?? false,
    );
  }
}
