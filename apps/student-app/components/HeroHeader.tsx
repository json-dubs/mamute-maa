import { Image, View } from "react-native";
import { Text, uiColors } from "@mamute/ui";

const logo = require("../assets/images/MamuteLogo.png");

export function HeroHeader({ title }: { title?: string }) {
  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.name}>Mamute Martial Arts Academy</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}

const styles = {
  container: {
    alignItems: "center",
    marginBottom: 8
  },
  logo: {
    width: 88,
    height: 88
  },
  name: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: uiColors.text,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    marginTop: 6,
    fontSize: 13,
    color: uiColors.accent
  }
} as const;
