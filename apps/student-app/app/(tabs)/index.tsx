import { useEffect, useState } from "react";
import { View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Badge, Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { fetchLinkedStudents } from "@mamute/api";
import { LinkedStudentSummary } from "@mamute/types";
import { classifyStanding } from "@mamute/utils";

export default function BarcodeScreen() {
  useKeepAwake();
  const [students, setStudents] = useState<LinkedStudentSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const linked = await fetchLinkedStudents();
        setStudents(linked);
      } catch (error) {
        console.warn("barcode load failed", error);
      }
    };
    load();
  }, []);

  return (
    <Screen>
      <HeroHeader title="Barcode" />
      {students.length ? (
        students.map((student) => {
          const statusView = classifyStanding(student.membershipStanding);
          const displayName = [student.firstName, student.lastName]
            .filter(Boolean)
            .join(" ");
          return (
            <Card key={student.studentId} style={{ alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 16 }}>{displayName || "Student"}</Text>
              <View
                style={{
                  width: "100%",
                  paddingVertical: 16,
                  borderWidth: 1,
                  borderColor: uiColors.border,
                  backgroundColor: uiColors.surfaceAlt,
                  alignItems: "center",
                  borderRadius: 10
                }}
              >
                <Text style={{ fontSize: 24, letterSpacing: 2, fontWeight: "700" }}>
                  {student.barcodeValue ?? "MMAA-"}
                </Text>
              </View>
              <Badge tone={statusView.tone} label={statusView.label} />
            </Card>
          );
        })
      ) : (
        <Card>
          <Text>Link a student profile in the Family tab to see barcodes.</Text>
        </Card>
      )}
      <Text>Show this barcode at the front desk for class check-in.</Text>
    </Screen>
  );
}
