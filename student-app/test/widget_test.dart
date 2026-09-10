import 'package:flutter_test/flutter_test.dart';
import 'package:shiksharthi_student/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ShikshaVaultApp());
    expect(find.byType(ShikshaVaultApp), findsOneWidget);
  });
}

