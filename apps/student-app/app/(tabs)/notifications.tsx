import { Card, Screen, Text } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";

export default function NotificationsScreen() {
  return (
    <Screen>
      <HeroHeader title="Alerts" />
      <Card>
        <Text>Notifications are not enabled yet in this new setup.</Text>
      </Card>
    </Screen>
  );
}
