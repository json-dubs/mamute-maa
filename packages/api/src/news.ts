import { getSupabaseClient } from "./client";
import { CreateMamuteNewsPostRequest, MamuteNewsPost } from "@mamute/types";

const NEWS_BUCKET = "mamute-news";

function normalizeNewsRow(row: any): MamuteNewsPost {
  const supabase = getSupabaseClient();
  const attachmentPath = row.attachment_path ?? row.attachmentPath ?? null;
  const attachmentUrl = attachmentPath
    ? supabase.storage.from(NEWS_BUCKET).getPublicUrl(attachmentPath).data.publicUrl
    : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    postType: row.post_type ?? row.postType ?? "general",
    visibility: row.visibility ?? "public",
    studentId: row.student_id ?? row.studentId ?? null,
    attachmentPath,
    attachmentName: row.attachment_name ?? row.attachmentName ?? null,
    attachmentMimeType: row.attachment_mime_type ?? row.attachmentMimeType ?? null,
    attachmentUrl,
    expiresAt: row.expires_at ?? row.expiresAt ?? null,
    createdAt: row.created_at ?? row.createdAt
  };
}

export async function fetchMamuteNews(options?: {
  includeExpired?: boolean;
}): Promise<MamuteNewsPost[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("mamute_news")
    .select(
      "id, title, description, post_type, visibility, student_id, attachment_path, attachment_name, attachment_mime_type, expires_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (!options?.includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeNewsRow);
}

export async function createMamuteNewsPost(
  payload: CreateMamuteNewsPostRequest
): Promise<MamuteNewsPost> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mamute_news")
    .insert({
      title: payload.title,
      description: payload.description,
      post_type: payload.postType ?? "general",
      visibility: payload.visibility ?? "public",
      student_id: payload.studentId ?? null,
      attachment_path: payload.attachmentPath ?? null,
      attachment_name: payload.attachmentName ?? null,
      attachment_mime_type: payload.attachmentMimeType ?? null,
      expires_at: payload.expiresAt ?? null
    })
    .select(
      "id, title, description, post_type, visibility, student_id, attachment_path, attachment_name, attachment_mime_type, expires_at, created_at"
    )
    .single();

  if (error) throw error;
  return normalizeNewsRow(data);
}

export async function deleteMamuteNewsPost(post: MamuteNewsPost) {
  const supabase = getSupabaseClient();
  if (post.attachmentPath) {
    await supabase.storage.from(NEWS_BUCKET).remove([post.attachmentPath]);
  }
  const { error } = await supabase.from("mamute_news").delete().eq("id", post.id);
  if (error) throw error;
}

export async function uploadMamuteNewsAttachment(file: File): Promise<{
  path: string;
  name: string;
  mimeType: string | null;
}> {
  const supabase = getSupabaseClient();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const filename = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `${new Date().toISOString().slice(0, 10)}/${filename}`;
  const { error } = await supabase.storage.from(NEWS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined
  });
  if (error) throw error;
  return {
    path,
    name: file.name,
    mimeType: file.type || null
  };
}
