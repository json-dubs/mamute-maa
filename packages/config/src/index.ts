export function getSupabaseConfig() {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "Supabase configuration is missing. Set URL/Anon key in environment."
    );
  }

  return { url, anonKey };
}

export const appMeta = {
  name: "Mamute MAA",
  barcodePrefix: "MMAA-"
};

export const gymMeta = {
  timezone: "America/Toronto",
  location: { latitude: 43.92171016104063, longitude: -78.87364279024405 },
  checkinRadiusMeters: 100
};
