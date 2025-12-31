import { useEffect, useState } from "react";
import { View } from "react-native";
import { Badge, Card, Screen, Text } from "@mamute/ui";
import { fetchMembershipStatus, fetchProfile } from "@mamute/api";
import { MembershipStatus } from "@mamute/types";
import { appMeta } from "@mamute/config";
import { classifyStatus } from "@mamute/utils";

export default function QrScreen() {
  const [barcode, setBarcode] = useState("MMAA-DEMO");
  const [membership, setMembership] = useState<MembershipStatus>("good");

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await fetchProfile();
        if (profile) {
          setBarcode(`${appMeta.barcodePrefix}${profile.id}`);
          const status = await fetchMembershipStatus(profile.id);
          setMembership(status);
        }
      } catch (error) {
        console.warn("barcode load failed", error);
      }
    };
    load();
  }, []);

  const statusView = classifyStatus(membership);

  return (
    <Screen title="My Barcode">
      <Card style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 16 }}>Show this at the front desk</Text>
        <View
          style={{
            width: "100%",
            paddingVertical: 16,
            borderWidth: 1,
            borderColor: "#1f2937",
            backgroundColor: "#0f172a",
            alignItems: "center",
            borderRadius: 10
          }}
        >
          <Text style={{ fontSize: 24, letterSpacing: 2, fontWeight: "700" }}>
            {barcode}
          </Text>
        </View>
        <Badge tone={statusView.tone} label={statusView.label} />
      </Card>
      <Text>
        Scans will record attendance and flag any overdue payments before class begins.
      </Text>
    </Screen>
  );
}
