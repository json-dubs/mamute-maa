import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { linkStudentAccess, recordAttendance, fetchLinkedStudents } from "@mamute/api";
import { LinkedStudentSummary } from "@mamute/types";
import { gymMeta } from "@mamute/config";
import { classifyStanding } from "@mamute/utils";

export default function FamilyScreen() {
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [students, setStudents] = useState<LinkedStudentSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedNumbers = useMemo(() => {
    return students
      .filter((student) => selected.includes(student.studentId))
      .map((student) => student.studentNumber);
  }, [students, selected]);

  const load = async () => {
    try {
      const linked = await fetchLinkedStudents();
      setStudents(linked);
      setSelected(linked.map((student) => student.studentId));
    } catch (error) {
      console.warn("Failed to load linked students", error);
    }
  };

  useEffect(() => {
    load();
  }, []);


  const linkStudent = async () => {
    const parsedNumber = Number.parseInt(studentNumber, 10);
    if (!Number.isFinite(parsedNumber) || !studentName.trim()) {
      Alert.alert("Missing info", "Enter student number and full name.");
      return;
    }
    setLoading(true);
    try {
      await linkStudentAccess({
        studentNumber: parsedNumber,
        studentName: studentName.trim(),
        parentName: parentName.trim() || undefined
      });
      setStudentNumber("");
      setStudentName("");
      await load();
    } catch (error: any) {
      Alert.alert("Link failed", error?.message ?? "Unable to link student.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const checkInSelected = async () => {
    if (!selectedNumbers.length) {
      Alert.alert("Select students", "Choose at least one student to check in.");
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "Enable location to check in.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const distance = haversineMeters(
        position.coords.latitude,
        position.coords.longitude,
        gymMeta.location.latitude,
        gymMeta.location.longitude
      );
      if (distance > gymMeta.checkinRadiusMeters) {
        Alert.alert(
          "Too far from gym",
          `You must be within ${gymMeta.checkinRadiusMeters}m to check in.`
        );
        return;
      }
      const response = await recordAttendance({
        studentNumbers: selectedNumbers,
        source: "mobile",
        locationVerified: true
      });
      const blocked = response.results.filter((result) => result.blocked);
      const ok = response.results.filter((result) => !result.blocked);
      Alert.alert(
        "Check-in complete",
        `${ok.length} checked in, ${blocked.length} blocked.`
      );
    } catch (error: any) {
      Alert.alert("Check-in failed", error?.message ?? "Unable to check in.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Screen>
      <HeroHeader title="Family" />
      <Card>
        <Text style={{ fontWeight: "700" }}>Link a student</Text>
        <TextInput
          value={studentNumber}
          onChangeText={setStudentNumber}
          placeholder="Student number"
          placeholderTextColor={uiColors.muted}
          keyboardType="number-pad"
          style={inputStyle}
        />
        <TextInput
          value={studentName}
          onChangeText={setStudentName}
          placeholder="Student full name"
          placeholderTextColor={uiColors.muted}
          style={inputStyle}
        />
        <TextInput
          value={parentName}
          onChangeText={setParentName}
          placeholder="Parent name (optional)"
          placeholderTextColor={uiColors.muted}
          style={inputStyle}
        />
        <Pressable onPress={linkStudent} style={buttonStyle} disabled={loading}>
          <Text style={buttonTextStyle}>
            {loading ? "Linking..." : "Link Student"}
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Row>
          <Text style={{ fontWeight: "700" }}>Linked students</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={checkInSelected} disabled={loading}>
              <Text style={{ color: uiColors.accent }}>
                {loading ? "Working..." : "Check in selected"}
              </Text>
            </Pressable>
          </View>
        </Row>
        {students.length ? (
          students.map((student) => {
            const statusView = classifyStanding(student.membershipStanding);
            const isSelected = selected.includes(student.studentId);
            const displayName = [student.firstName, student.lastName]
              .filter(Boolean)
              .join(" ");
            return (
              <Pressable
                key={student.studentId}
                onPress={() => toggleStudent(student.studentId)}
                style={[
                  selectionStyle,
                  isSelected ? selectionStyleSelected : null
                ]}
              >
                <Row>
                  <Text>
                    {isSelected ? "✓" : "○"} {displayName || "Student"}
                  </Text>
                  <Badge tone={statusView.tone} label={statusView.label} />
                </Row>
                <Text style={{ color: uiColors.muted }}>
                  #{student.studentNumber}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Text>No students linked yet.</Text>
        )}
      </Card>
    </Screen>
  );
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

const inputStyle = {
  backgroundColor: uiColors.surfaceAlt,
  color: uiColors.text,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: uiColors.border
};

const buttonStyle = {
  backgroundColor: uiColors.accent,
  padding: 12,
  borderRadius: 10,
  alignItems: "center"
};

const buttonTextStyle = {
  color: "#0b1220",
  fontWeight: "700"
};

const selectionStyle = {
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: uiColors.border,
  backgroundColor: uiColors.surfaceAlt,
  marginTop: 10
};

const selectionStyleSelected = {
  borderColor: uiColors.accent
};
