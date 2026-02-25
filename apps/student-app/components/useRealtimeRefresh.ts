import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { getSupabaseClient } from "@mamute/api";

interface UseRealtimeRefreshOptions {
  name: string;
  tables: string[];
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
}

export function useRealtimeRefresh({
  name,
  tables,
  onRefresh,
  enabled = true,
  debounceMs = 250
}: UseRealtimeRefreshOptions) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const onRefreshRef = useRef(onRefresh);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableKey = tables.join("|");

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const triggerRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      void onRefreshRef.current();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (!enabled || !tableKey) return;

    const channel = supabase.channel(`refresh-${name}-${Math.random().toString(36).slice(2)}`);
    for (const table of tableKey.split("|")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        triggerRefresh
      );
    }
    channel.subscribe();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, name, supabase, tableKey, triggerRefresh]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        triggerRefresh();
      }
    });
    return () => subscription.remove();
  }, [enabled, triggerRefresh]);
}
