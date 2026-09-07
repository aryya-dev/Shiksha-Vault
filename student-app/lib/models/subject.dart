class SubjectModel {
  final String id;
  final String name;
  final String slug;
  final String? color;

  SubjectModel({
    required this.id,
    required this.name,
    required this.slug,
    this.color,
  });

  factory SubjectModel.fromJson(Map<String, dynamic> json) {
    return SubjectModel(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      color: json['color'] as String?,
    );
  }
}
