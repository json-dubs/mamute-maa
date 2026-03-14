import { useCallback, useEffect, useMemo, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { fetchShopMerchandise } from "@mamute/api";
import { ShopMerchandiseRecord, ShopMerchandiseSex, ShopMerchandiseType } from "@mamute/types";

type ShopView = "home" | "memberships" | "merchandise";
type MembershipView = "upfront" | "monthly";

const waiverUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSfh3pRaE4VnjorBY_TsS3--5LD6h-C_DPeZQzQQJwBZQfyuiw/viewform";
const kidsMembershipUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSeUtxBlwSM6_9PrDWH8kwte66T5ZDD-J06PSXfZZoreyzGWgA/viewform";
const adultMembershipUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSebBQTcxqgcYEFGtUcjMHo3H0fWzxAlFSJpGzbs3np8Popo4A/viewform";
const reviewsUrl =
  "https://www.google.com/search?sca_esv=a8e9eb64a8fa43d9&sxsrf=ANbL-n7qvpGpIkR2VnV4M-Z2YfVf1EgCJw:1773328983093&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOWLd7RLEqPmK2CRIE8c93-lKMc_sx2CrjX5sFRcGVhUfexossb8u8ZRsxYgX4Jj8evkNv8ZgqAL_uZbh4gcHnaWw7kzwbbLS8o4UMw5-Lw9RwsAcvA%3D%3D&q=Mamute+Martial+Arts+Academy+Reviews&sa=X&ved=2ahUKEwjAsu2g1ZqTAxXE38kDHV8EHD8Q0bkNegQIKhAH&biw=1270&bih=543&dpr=1.5";

const monthlyMemberships = [
  {
    title: "Base",
    price: "$100 + HST / month",
    description:
      "Great for beginners easing into routine training. Includes 1 class per week."
  },
  {
    title: "Kids Grappling",
    price: "$185 + HST / month",
    description:
      "Unlimited kids grappling classes, including Brazilian Jiu-Jitsu and Wrestling."
  },
  {
    title: "Kids Striking",
    price: "$160 + HST / month",
    description: "Unlimited kids striking classes, focused on Muay Thai development."
  },
  {
    title: "Kids All Classes",
    price: "$205 + HST / month",
    description:
      "Complete kids program access for both grappling and striking classes every week."
  },
  {
    title: "Adult Striking",
    price: "$185 + HST / month",
    description: "Unlimited access to Muay Thai and Boxing for adults."
  },
  {
    title: "Adult Grappling",
    price: "$160 + HST / month",
    description: "Unlimited access to adult Brazilian Jiu-Jitsu and Wrestling classes."
  },
  {
    title: "Adult All Classes",
    price: "$205 + HST / month",
    description:
      "All striking and grappling classes, plus MMA for a full cross-training path."
  }
];

const upfrontMemberships = [
  {
    title: "3 Months Upfront",
    price: "$580 + HST",
    description: "Unlimited class access at a strong short-term commitment rate."
  },
  {
    title: "6 Months Upfront",
    price: "$1080 + HST",
    description: "Unlimited access with better savings and consistency support."
  },
  {
    title: "12 Months Upfront",
    price: "$1950 + HST",
    description:
      "Best value annual option with unlimited training and long-term progression focus."
  }
];

const sexFilterOptions: Array<{ value: "all" | ShopMerchandiseSex; label: string }> = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unisex", label: "Unisex" }
];

const typeFilterOptions: Array<{ value: "all" | ShopMerchandiseType; label: string }> = [
  { value: "all", label: "All" },
  { value: "uniform", label: "Uniform" },
  { value: "shirt", label: "Shirt" },
  { value: "sweater", label: "Sweater" },
  { value: "jacket", label: "Jacket" },
  { value: "pants", label: "Pants" },
  { value: "shorts", label: "Shorts" },
  { value: "accessory", label: "Accessory" },
  { value: "training", label: "Training" }
];

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const wide = width >= 760;
  const sectionTitleStyle = compact ? styles.sectionTitleCompact : styles.sectionTitle;
  const introTitleStyle = compact ? styles.introTitleCompact : styles.introTitle;
  const featureTitleStyle = compact ? styles.featureTitleCompact : styles.featureTitle;
  const lineDescriptionStyle = compact ? styles.lineDescriptionCompact : styles.lineDescription;

  const [view, setView] = useState<ShopView>("home");
  const [membershipView, setMembershipView] = useState<MembershipView>("upfront");
  const [items, setItems] = useState<ShopMerchandiseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | ShopMerchandiseType>("all");
  const [sexFilter, setSexFilter] = useState<"all" | ShopMerchandiseSex>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchShopMerchandise();
      setItems(data);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load merchandise.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh({
    name: "shop",
    tables: ["shop_merchandise"],
    onRefresh: load
  });

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (typeFilter !== "all" && item.itemType !== typeFilter) return false;
        if (sexFilter !== "all" && item.sex !== sexFilter) return false;
        const query = searchQuery.trim().toLowerCase();
        if (query) {
          const haystack =
            `${item.name} ${item.description} ${item.itemType} ${item.sex} ${item.sizes.join(" ")}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [items, searchQuery, sexFilter, typeFilter]
  );

  return (
    <Screen>
      <HeroHeader title="Mamute Shop" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: compact ? 96 : 120 }}
      >
        {view === "home" ? (
          <>
            <Card style={styles.introCard}>
              <Text style={introTitleStyle}>Your Mamute Training Hub</Text>
              <Text style={styles.introCopy}>
                Explore memberships, complete sign-up forms, and browse official Mamute gear.
              </Text>
            </Card>

            <View style={wide ? styles.featureGridWide : styles.featureGrid}>
              <Pressable
                style={[styles.featureCard, wide ? styles.featureCardWide : null]}
                onPress={() => setView("memberships")}
              >
                <View style={styles.featureIconWrap}>
                  <FontAwesome name="id-card" size={20} color="#fecaca" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={featureTitleStyle}>Memberships</Text>
                  <Text style={styles.featureCopy}>
                    Compare plans, pricing, and submit forms fast.
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color="#fca5a5" />
              </Pressable>

              <Pressable
                style={[styles.featureCardAlt, wide ? styles.featureCardWide : null]}
                onPress={() => setView("merchandise")}
              >
                <View style={styles.featureIconWrapAlt}>
                  <FontAwesome name="shopping-bag" size={20} color="#bfdbfe" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={featureTitleStyle}>Merchandise</Text>
                  <Text style={styles.featureCopy}>
                    View uniforms and training gear added by admin.
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color="#93c5fd" />
              </Pressable>
            </View>

            <Card style={{ marginTop: 12 }}>
              <Text style={sectionTitleStyle}>Help Mamute Grow</Text>
              <Text style={styles.sectionMuted}>
                Love your experience? A quick Google review helps new students find us.
              </Text>
              <LinkButton label="Leave a Google Review" onPress={() => openExternal(reviewsUrl)} />
            </Card>
          </>
        ) : null}

        {view === "memberships" ? (
          <>
            <BackButton onPress={() => setView("home")} />
            <Card style={styles.membershipHeroCard}>
              <Text style={sectionTitleStyle}>Interested in a Mamute Membership?</Text>
              <Text style={styles.sectionMuted}>
                You'll find all of our membership types and pricing below, along with sign up links.
              </Text>
            </Card>

            <Card style={{ marginTop: 12 }}>
              <Text style={styles.filterTitle}>Choose Membership Type</Text>
              <View style={compact ? styles.toggleColumn : styles.toggleRow}>
                <Pressable
                  style={[
                    styles.toggleButton,
                    membershipView === "upfront" ? styles.toggleButtonActive : null
                  ]}
                  onPress={() => setMembershipView("upfront")}
                >
                  <Text style={membershipView === "upfront" ? styles.toggleTextActive : styles.toggleText}>
                    Upfront
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleButton,
                    membershipView === "monthly" ? styles.toggleButtonActive : null
                  ]}
                  onPress={() => setMembershipView("monthly")}
                >
                  <Text style={membershipView === "monthly" ? styles.toggleTextActive : styles.toggleText}>
                    Monthly
                  </Text>
                </Pressable>
              </View>

              {(membershipView === "upfront" ? upfrontMemberships : monthlyMemberships).map(
                (entry) => (
                  <View key={entry.title} style={styles.membershipCard}>
                    <Text style={styles.lineTitle}>{entry.title}</Text>
                    <Text style={styles.linePrice}>{entry.price}</Text>
                    <Text style={lineDescriptionStyle}>{entry.description}</Text>
                  </View>
                )
              )}

              <View style={styles.classPassCard}>
                <Text style={styles.lineTitle}>5-Class Pass</Text>
                <Text style={styles.linePrice}>$150 + HST</Text>
                <Text style={lineDescriptionStyle}>
                  Flexible option for students who want to train without a monthly commitment.
                </Text>
              </View>
            </Card>

            <Card style={{ marginTop: 12 }}>
              <Text style={sectionTitleStyle}>Forms & Sign Up</Text>
              <Text style={styles.sectionMuted}>
                Complete your waiver and the correct membership form before your first class.
              </Text>
              <View style={styles.linkRow}>
                <LinkButton label="Waiver Form" onPress={() => openExternal(waiverUrl)} />
                <LinkButton
                  label="Kids Membership Form"
                  onPress={() => openExternal(kidsMembershipUrl)}
                />
                <LinkButton
                  label="Adult Membership Form"
                  onPress={() => openExternal(adultMembershipUrl)}
                />
              </View>
            </Card>
          </>
        ) : null}

        {view === "merchandise" ? (
          <>
            <BackButton onPress={() => setView("home")} />
            <Card style={styles.merchHeroCard}>
              <Text style={sectionTitleStyle}>Mamute Merchandise</Text>
              <Text style={styles.sectionMuted}>
                Find uniforms and gym essentials. Filter quickly by category, fit, and search.
              </Text>
            </Card>

            <Card style={{ marginTop: 12 }}>
              <View style={styles.headerRow}>
                <Text style={sectionTitleStyle}>Available Gear</Text>
                <Pressable onPress={load}>
                  <Text style={{ color: uiColors.accent }}>{loading ? "Refreshing..." : "Refresh"}</Text>
                </Pressable>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search merchandise"
                placeholderTextColor={uiColors.muted}
                style={styles.searchInput}
              />

              <Text style={styles.filterTitle}>Item Type</Text>
              <View style={styles.filterRow}>
                {typeFilterOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={typeFilter === option.value}
                    onPress={() => setTypeFilter(option.value)}
                  />
                ))}
              </View>

              <Text style={styles.filterTitle}>Sex</Text>
              <View style={styles.filterRow}>
                {sexFilterOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={sexFilter === option.value}
                    onPress={() => setSexFilter(option.value)}
                  />
                ))}
              </View>

              {message ? <Text style={styles.error}>{message}</Text> : null}

              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <Card key={item.id} style={styles.itemCard}>
                    {item.imageUrl ? <MerchandiseImage uri={item.imageUrl} /> : null}
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {capitalize(item.itemType)} | {capitalize(item.sex)}
                    </Text>
                    <Text style={lineDescriptionStyle}>{item.description}</Text>
                    <View style={styles.sizesRow}>
                      {item.sizes.length ? (
                        item.sizes.map((size) => (
                          <View key={`${item.id}-${size}`} style={styles.sizeChip}>
                            <Text style={styles.sizeChipText}>{size}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.itemMeta}>Sizes on request</Text>
                      )}
                    </View>
                  </Card>
                ))
              ) : (
                <Text style={styles.sectionMuted}>No items available for this filter.</Text>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.backButton} onPress={onPress}>
      <FontAwesome name="arrow-left" size={14} color="#f8fafc" />
      <Text style={styles.backButtonText}>Back to Shop Home</Text>
    </Pressable>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkButton} onPress={onPress}>
      <Text style={styles.linkButtonText}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
    >
      <Text style={active ? styles.filterChipTextActive : styles.filterChipText}>{label}</Text>
    </Pressable>
  );
}

function MerchandiseImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(1.25);
  return (
    <View style={styles.imageFrame}>
      <Image
        source={{ uri }}
        style={[styles.image, { aspectRatio: ratio }]}
        resizeMode="contain"
        onLoad={(event) => {
          const width = event.nativeEvent.source?.width ?? 0;
          const height = event.nativeEvent.source?.height ?? 0;
          if (width > 0 && height > 0) {
            setRatio(width / height);
          }
        }}
      />
    </View>
  );
}

async function openExternal(url: string) {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  introCard: {
    borderColor: "#5a191f",
    backgroundColor: "#1e0c10"
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "800"
  },
  introTitleCompact: {
    fontSize: 17,
    fontWeight: "800"
  },
  introCopy: {
    color: "#fecaca",
    lineHeight: 21
  },
  featureGrid: {
    marginTop: 12,
    gap: 10
  },
  featureGridWide: {
    marginTop: 12,
    gap: 12,
    flexDirection: "row"
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#2a0d10",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  featureCardAlt: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e3a8a",
    backgroundColor: "#0f1a34",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  featureCardWide: {
    flex: 1
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#3f1016",
    justifyContent: "center",
    alignItems: "center"
  },
  featureIconWrapAlt: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1e3a8a",
    backgroundColor: "#15254d",
    justifyContent: "center",
    alignItems: "center"
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  featureTitleCompact: {
    fontSize: 16,
    fontWeight: "800"
  },
  featureCopy: {
    color: uiColors.muted
  },
  backButton: {
    marginTop: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  backButtonText: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  membershipHeroCard: {
    borderColor: "#7c2d12",
    backgroundColor: "#2b150c"
  },
  merchHeroCard: {
    borderColor: "#1e3a8a",
    backgroundColor: "#0f1c3d"
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800"
  },
  sectionTitleCompact: {
    fontSize: 16,
    fontWeight: "800"
  },
  sectionMuted: {
    color: uiColors.muted
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  filterTitle: {
    fontWeight: "700",
    marginTop: 6
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10
  },
  toggleColumn: {
    gap: 10
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingVertical: 10,
    alignItems: "center"
  },
  toggleButtonActive: {
    backgroundColor: uiColors.accent,
    borderColor: uiColors.accent
  },
  toggleText: {
    color: uiColors.text,
    fontWeight: "700"
  },
  toggleTextActive: {
    color: "#0b1220",
    fontWeight: "800"
  },
  membershipCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    padding: 11,
    gap: 4
  },
  classPassCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#14532d",
    backgroundColor: "#102816",
    padding: 11,
    gap: 4
  },
  lineTitle: {
    fontWeight: "800"
  },
  linePrice: {
    color: "#fde68a",
    fontWeight: "700"
  },
  lineDescription: {
    color: uiColors.muted
  },
  lineDescriptionCompact: {
    color: uiColors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  linkRow: {
    gap: 8
  },
  linkButton: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  linkButtonText: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  searchInput: {
    backgroundColor: uiColors.surfaceAlt,
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 10,
    color: uiColors.text,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingVertical: 7,
    paddingHorizontal: 10
  },
  filterChipActive: {
    backgroundColor: uiColors.accent,
    borderColor: uiColors.accent
  },
  filterChipText: {
    color: uiColors.text,
    fontWeight: "700"
  },
  filterChipTextActive: {
    color: "#0b1220",
    fontWeight: "800"
  },
  error: {
    color: "#fca5a5"
  },
  itemCard: {
    marginTop: 10
  },
  imageFrame: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: "#0a0a0a"
  },
  image: {
    width: "100%"
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  itemMeta: {
    color: uiColors.muted
  },
  itemDescription: {
    color: "#f3f4f6"
  },
  sizesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sizeChip: {
    borderRadius: 999,
    backgroundColor: "#122032",
    borderWidth: 1,
    borderColor: "#27425e",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  sizeChipText: {
    color: "#bfdbfe",
    fontWeight: "700"
  }
});
