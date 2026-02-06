type EnvGetter = (key: string) => string | undefined;

const getEnvValue: EnvGetter = (key) =>
  typeof process !== "undefined" && process.env ? process.env[key] : undefined;

export function getSupabaseConfig() {
  const url =
    getEnvValue("EXPO_PUBLIC_SUPABASE_URL") ||
    getEnvValue("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnvValue("SUPABASE_URL");
  const anonKey =
    getEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnvValue("SUPABASE_ANON_KEY");

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