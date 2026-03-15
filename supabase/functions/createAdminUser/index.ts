import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface CreateAdminRequest {
  email: string;
  firstName: string;
  lastName: string;
  redirectTo?: string;
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

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function isAlreadyRegisteredError(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes("already been registered") ||
    value.includes("already registered") ||
    value.includes("already exists")
  );
}

function isRateLimitError(message: string) {
  return message.toLowerCase().includes("rate limit");
}

function buildInviteOptions(firstName: string, lastName: string, redirectTo?: string) {
  const displayName = `${firstName} ${lastName}`.trim();
  return {
    data: {
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      invited_setup_required: true
    },
    ...(redirectTo ? { redirectTo } : {})
  };
}

function isLocalhostUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveRedirectTo(payloadRedirectTo?: string, requestOrigin?: string) {
  const payloadValue = payloadRedirectTo?.trim();
  const originValue = requestOrigin?.trim();

  if (payloadValue) {
    if (isLocalhostUrl(payloadValue) && !(originValue && isLocalhostUrl(originValue))) {
      return undefined;
    }
    return payloadValue;
  }

  if (originValue && isHttpUrl(originValue) && !isLocalhostUrl(originValue)) {
    return originValue;
  }

  return undefined;
}

function getInviteTokenFromActionLink(actionLink?: string | null) {
  if (!actionLink) return null;
  try {
    const parsed = new URL(actionLink);
    return parsed.searchParams.get("token_hash") ?? parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

function buildDirectInviteDeepLink(redirectTo: string | undefined, tokenHash: string | null) {
  if (!redirectTo || !tokenHash) return null;
  try {
    const parsed = new URL(redirectTo);
    parsed.searchParams.set("type", "invite");
    parsed.searchParams.set("token_hash", tokenHash);
    return parsed.toString();
  } catch {
    const joiner = redirectTo.includes("?") ? "&" : "?";
    return `${redirectTo}${joiner}type=invite&token_hash=${encodeURIComponent(tokenHash)}`;
  }
}

async function upsertAdminProfile(
  supabase: ReturnType<typeof createClient>,
  params: { userId: string; firstName: string; lastName: string; email: string }
) {
  const fullName = `${params.firstName} ${params.lastName}`.trim();

  const primary = await supabase.from("admins").upsert(
    {
      user_id: params.userId,
      first_name: params.firstName,
      last_name: params.lastName,
      email: params.email
    },
    { onConflict: "user_id" }
  );

  if (!primary.error) {
    return { error: null };
  }

  const message = (primary.error.message ?? "").toLowerCase();
  const legacyNameSchema =
    message.includes("first_name") ||
    message.includes("last_name") ||
    message.includes("column") ||
    message.includes("schema cache");

  if (!legacyNameSchema) {
    return { error: primary.error };
  }

  const fallbackLegacy = await supabase.from("admins").upsert(
    {
      user_id: params.userId,
      full_name: fullName,
      email: params.email
    },
    { onConflict: "user_id" }
  );

  if (!fallbackLegacy.error) {
    return { error: null };
  }

  const fallbackMinimal = await supabase.from("admins").upsert(
    {
      user_id: params.userId,
      email: params.email
    },
    { onConflict: "user_id" }
  );

  return { error: fallbackMinimal.error ?? fallbackLegacy.error };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey =
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return new Response("Missing SUPABASE_URL or keys", {
        status: 500,
        headers: corsHeaders
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false }
    });

    const { data: isAdmin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (!isAdmin) {
      return jsonResponse({ error: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json()) as CreateAdminRequest;
    const email = payload?.email?.trim().toLowerCase();
    const firstName = payload?.firstName?.trim();
    const lastName = payload?.lastName?.trim();
    const redirectTo = resolveRedirectTo(payload?.redirectTo, req.headers.get("origin") ?? undefined);

    if (!email || !firstName || !lastName) {
      return jsonResponse({ error: "MISSING_FIELDS" }, 400);
    }

    const invite = () =>
      supabase.auth.admin.inviteUserByEmail(
        email,
        buildInviteOptions(firstName, lastName, redirectTo)
      );

    let inviteResult = await invite();

    if (inviteResult.error || !inviteResult.data.user) {
      const inviteMessage = inviteResult.error?.message ?? "CREATE_ADMIN_FAILED";

      if (isAlreadyRegisteredError(inviteMessage)) {
        const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });

        if (!listError) {
          const existing = listed.users.find(
            (item) => (item.email ?? "").toLowerCase() === email
          );

          if (
            existing &&
            !existing.email_confirmed_at &&
            !existing.last_sign_in_at
          ) {
            const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id);
            if (!deleteError) {
              inviteResult = await invite();
            }
          }
        }
      }
    }

    let createdUserId = inviteResult.data?.user?.id ?? null;
    let inviteLink: string | null = null;
    let delivery: "email" | "manual_link" = "email";

    if (inviteResult.error || !inviteResult.data.user) {
      const inviteError = inviteResult.error?.message ?? "CREATE_ADMIN_FAILED";

      if (isRateLimitError(inviteError)) {
        const { data: generated, error: generateError } =
          await supabase.auth.admin.generateLink({
            type: "invite",
            email,
            options: buildInviteOptions(firstName, lastName, redirectTo)
          });

        if (generateError || !generated?.user?.id) {
          return jsonResponse(
            {
              error: generateError?.message ?? inviteError
            },
            400
          );
        }

        createdUserId = generated.user.id;
        const actionLink = generated.properties?.action_link ?? null;
        const tokenHash =
          generated.properties?.hashed_token ??
          getInviteTokenFromActionLink(actionLink);
        inviteLink = buildDirectInviteDeepLink(redirectTo, tokenHash) ?? actionLink;
        delivery = "manual_link";
      } else {
        return jsonResponse(
          {
            error: inviteError
          },
          400
        );
      }
    }

    if (!createdUserId) {
      return jsonResponse({ error: "CREATE_ADMIN_FAILED" }, 400);
    }

    // Always try to provide a manual fallback link even when email delivery succeeded.
    // This makes invites operational if mailbox delivery is delayed or filtered.
    if (!inviteLink) {
      const { data: generated } = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: buildInviteOptions(firstName, lastName, redirectTo)
      });
      const actionLink = generated?.properties?.action_link ?? null;
      const tokenHash =
        generated?.properties?.hashed_token ??
        getInviteTokenFromActionLink(actionLink);
      inviteLink = buildDirectInviteDeepLink(redirectTo, tokenHash) ?? actionLink;
    }

    const { error: upsertError } = await upsertAdminProfile(supabase, {
      userId: createdUserId,
      firstName,
      lastName,
      email
    });

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 400);
    }

    return jsonResponse({ id: createdUserId, email, delivery, inviteLink, redirectTo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNEXPECTED_ERROR";
    return jsonResponse({ error: message }, 500);
  }
});
