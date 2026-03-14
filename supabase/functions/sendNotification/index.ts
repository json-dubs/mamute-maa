import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface PushJob {
  id: string;
  title: string;
  body: string;
  target: { profileId?: string; studentId?: string; classId?: string; role?: string };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export const config = {
  verify_jwt: false
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authUser = await requireAdminUser(req);
    const supabase = createServiceClient();
    const payload = (await req.json()) as PushJob;

    console.log(
      JSON.stringify({
        event: "push_request_received",
        id: payload.id,
        title: payload.title,
        target: payload.target,
        requesterId: authUser.id
      })
    );

    const tokens = await fetchTokens(supabase, payload.target);
    console.log(
      JSON.stringify({
        event: "push_tokens_resolved",
        id: payload.id,
        tokenCount: tokens.length
      })
    );

    const expoResult = await fanOutExpo(tokens, payload);

    await supabase
      .from("notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", payload.id);

    return Response.json({
      delivered: tokens.length,
      expoResult
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown push error";
    console.error(
      JSON.stringify({
        event: "push_delivery_failed",
        message
      })
    );
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

async function fetchTokens(client: any, target: PushJob["target"]) {
  let query = client.from("push_tokens").select("expo_token, app_variant");
  const profileIds = await resolveTargetProfileIds(client, target);
  const isTargetedRequest = Boolean(target.profileId || target.studentId);
  if (isTargetedRequest && !profileIds.length) {
    throw new Error("No linked mobile accounts found for this private notification target.");
  }
  if (profileIds.length) {
    query = query.in("profile_id", profileIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load push tokens: ${error.message}`);
  }
  const allowedVariants = new Set(["standalone", "bare", null, "", "unknown"]);
  const rows = (data ?? []) as { expo_token: string; app_variant?: string | null }[];
  const filtered = rows.filter((row) => allowedVariants.has(row.app_variant ?? null));
  console.log(
    JSON.stringify({
      event: "push_token_variant_filter",
      total: rows.length,
      kept: filtered.length,
      targeted: isTargetedRequest,
      profileCount: profileIds.length,
      variants: rows.map((row) => row.app_variant ?? null)
    })
  );
  if (isTargetedRequest && !filtered.length) {
    throw new Error(
      "No push tokens found for linked mobile account(s). Ask user to open Mamute app and re-link."
    );
  }
  return filtered;
}

async function resolveTargetProfileIds(client: any, target: PushJob["target"]) {
  if (target.profileId) return [target.profileId];
  if (target.studentId) {
    const { data, error } = await client
      .from("student_access")
      .select("user_id")
      .eq("student_id", target.studentId)
      .not("user_id", "is", null);
    if (error) {
      throw new Error(`Failed to resolve student links: ${error.message}`);
    }
    const ids = [
      ...new Set(
        ((data ?? []) as { user_id?: string | null }[])
          .map((row) => row.user_id?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ];
    return ids;
  }
  return [];
}

async function fanOutExpo(tokens: any[], payload: PushJob) {
  if (!tokens.length) {
    return {
      status: "no_tokens",
      tickets: []
    };
  }

  const chunks = tokens.map((row) => ({
    to: row.expo_token,
    title: payload.title,
    body: payload.body
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(chunks)
  });

  const responseText = await response.text();
  let responseBody: unknown = null;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  console.log(
    JSON.stringify({
      event: "expo_push_response",
      status: response.status,
      ok: response.ok,
      body: responseBody
    })
  );

  if (!response.ok) {
    throw new Error(
      `Expo push API returned ${response.status}: ${truncateForLog(responseText)}`
    );
  }

  const tickets =
    responseBody &&
    typeof responseBody === "object" &&
    "data" in responseBody &&
    Array.isArray((responseBody as { data?: unknown[] }).data)
      ? ((responseBody as { data: unknown[] }).data ?? [])
      : [];

  const ticketErrors = tickets
    .map((ticket, index) => ({ ticket, index }))
    .filter(({ ticket }) => isErroredTicket(ticket));

  if (ticketErrors.length) {
    console.warn(
      JSON.stringify({
        event: "expo_push_ticket_errors",
        rejectedCount: ticketErrors.length,
        totalCount: tickets.length,
        errors: ticketErrors.map(({ ticket, index }) => ({
          index,
          ticket
        }))
      })
    );

    const rejectedTokens = ticketErrors
      .filter(({ ticket }) => shouldPruneToken(ticket))
      .map(({ index }) => tokens[index]?.expo_token)
      .filter((token): token is string => Boolean(token));

    if (rejectedTokens.length) {
      const serviceClient = createServiceClient();
      const { error: pruneError } = await serviceClient
        .from("push_tokens")
        .delete()
        .in("expo_token", rejectedTokens);

      if (pruneError) {
        console.error(
          JSON.stringify({
            event: "push_token_prune_failed",
            count: rejectedTokens.length,
            message: pruneError.message
          })
        );
      } else {
        console.log(
          JSON.stringify({
            event: "push_token_pruned",
            count: rejectedTokens.length
          })
        );
      }
    }

    if (ticketErrors.length === tickets.length) {
      throw new Error(
        `Expo rejected ${ticketErrors.length} push notification(s): ${JSON.stringify(
          ticketErrors.map(({ ticket }) => ticket)
        )}`
      );
    }
  }

  return {
    status: ticketErrors.length ? "partial_success" : "ok",
    tickets,
    rejectedCount: ticketErrors.length
  };
}

function createServiceClient() {
  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false } });
}

async function requireAdminUser(req: Request) {
  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Missing PROJECT_URL or ANON_KEY");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Unauthorized requester");
  }

  const serviceClient = createServiceClient();
  const { data: adminRow, error: adminError } = await serviceClient
    .from("admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (adminError) {
    throw new Error(`Failed to verify admin access: ${adminError.message}`);
  }

  if (!adminRow) {
    throw new Error("Requester is not an admin");
  }

  return authData.user;
}

function isErroredTicket(ticket: unknown) {
  return Boolean(
    ticket &&
      typeof ticket === "object" &&
      "status" in ticket &&
      (ticket as { status?: string }).status === "error"
  );
}

function shouldPruneToken(ticket: unknown) {
  if (!ticket || typeof ticket !== "object") return false;
  const details =
    "details" in ticket && ticket.details && typeof ticket.details === "object"
      ? (ticket.details as { error?: string })
      : null;
  const errorCode = details?.error ?? "";
  return errorCode === "DeviceNotRegistered" || errorCode === "InvalidCredentials";
}

function truncateForLog(value: string, maxLength = 500) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}
