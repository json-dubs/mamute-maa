import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { fetchMamuteNews } from "@mamute/api";
import { MamuteNewsPost } from "@mamute/types";

const birthdayImage = require("../../assets/images/MamuteBday.png");
const birthdayImageAsset = Image.resolveAssetSource(birthdayImage);
const birthdayImageRatio =
  birthdayImageAsset?.width && birthdayImageAsset?.height
    ? birthdayImageAsset.width / birthdayImageAsset.height
    : 1;

export default function NewsScreen() {
  const [posts, setPosts] = useState<MamuteNewsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchMamuteNews();
      setPosts(data);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load news.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh({
    name: "news",
    tables: ["mamute_news", "student_badges", "badges"],
    onRefresh: load
  });

  return (
    <Screen>
      <HeroHeader title="Mamute News" />
      <Card style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Latest Posts</Text>
          <Pressable onPress={load} style={styles.refreshButton}>
            <Text style={styles.refreshText}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
        </View>
        <Text style={styles.headerSubtitle}>
          Events, announcements, and gym updates from admin.
        </Text>
        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </Card>

      <ScrollView showsVerticalScrollIndicator={false}>
        {posts.length ? (
          posts.map((post) => {
            const isImage = (post.attachmentMimeType ?? "").startsWith("image/");
            const isBirthdayPost = post.postType === "birthday";
            const attachmentLabel = post.attachmentName ?? "Attachment";
            return (
              <Card key={post.id} style={styles.postCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.postedText}>Posted {formatDate(post.createdAt)}</Text>
                  {post.expiresAt ? (
                    <View style={styles.expiryChip}>
                      <Text style={styles.expiryText}>Expires {formatDate(post.expiresAt)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.title}>{post.title}</Text>
                <Text style={styles.description}>{post.description}</Text>

                {isBirthdayPost ? (
                  <BirthdayImage />
                ) : null}

                {!isBirthdayPost && post.attachmentUrl && isImage ? (
                  <NewsImage uri={post.attachmentUrl} />
                ) : null}

                {!isBirthdayPost && !isImage && post.attachmentUrl ? (
                  <View style={styles.attachmentBadge}>
                    <Text style={styles.attachmentText}>
                      Attachment: {attachmentLabel}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card>
            <Text style={{ color: uiColors.muted }}>No active news posts.</Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function NewsImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(1);

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

function BirthdayImage() {
  const [width, setWidth] = useState(0);
  const height = width > 0 ? width / birthdayImageRatio : 0;

  return (
    <View
      style={styles.imageFrame}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== width) {
          setWidth(nextWidth);
        }
      }}
    >
      {width > 0 ? (
        <Image
          source={birthdayImage}
          style={{ width, height }}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: 2
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1
  },
  headerSubtitle: {
    color: uiColors.muted,
    marginTop: 2
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0
  },
  refreshText: {
    color: uiColors.accent,
    fontWeight: "700"
  },
  errorText: {
    color: "#fca5a5"
  },
  postCard: {
    marginBottom: 10
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  postedText: {
    color: uiColors.muted,
    fontSize: 12
  },
  expiryChip: {
    borderWidth: 1,
    borderColor: "#5a3311",
    backgroundColor: "#3a220f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  expiryText: {
    color: "#fed7aa",
    fontSize: 11,
    fontWeight: "700"
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24
  },
  description: {
    color: "#f3f4f6",
    lineHeight: 21
  },
  imageFrame: {
    marginTop: 8,
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: "#0a0a0a"
  },
  image: {
    width: "100%"
  },
  attachmentBadge: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  attachmentText: {
    color: uiColors.muted
  }
});
