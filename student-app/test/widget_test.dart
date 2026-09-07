import 'package:flutter_test/flutter_test.dart';
import 'package:shiksharthi_student/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ShiksharthiApp());
    expect(find.byType(ShiksharthiApp), findsOneWidget);
  });
}
