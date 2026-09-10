class BatchModel {
  final String id;
  final String name;
  final String? className;
  final String? board;

  BatchModel({
    required this.id,
    required this.name,
    this.className,
    this.board,
  });

  bool get isFoundation =>
      (board?.toLowerCase() == 'foundation') ||
      name.toLowerCase().contains('foundation');

  factory BatchModel.fromJson(Map<String, dynamic> json) {
    return BatchModel(
      id: json['id'] as String,
      name: json['name'] as String,
      className: json['class_name'] as String?,
      board: json['board'] as String?,
    );
  }
}
