import {
  CreateShopMerchandiseRequest,
  ShopMerchandiseRecord,
  ShopMerchandiseSex,
  ShopMerchandiseType,
  UpdateShopMerchandiseRequest
} from "@mamute/types";
import { getSupabaseClient } from "./client";

const SHOP_BUCKET = "mamute-shop";

function normalizeShopMerchandiseRow(row: any): ShopMerchandiseRecord {
  const supabase = getSupabaseClient();
  const imagePath = row.image_path ?? row.imagePath ?? null;
  const imageUrl = imagePath
    ? supabase.storage.from(SHOP_BUCKET).getPublicUrl(imagePath).data.publicUrl
    : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    itemType: row.item_type ?? row.itemType,
    sex: row.sex,
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    imagePath,
    imageName: row.image_name ?? row.imageName ?? null,
    imageMimeType: row.image_mime_type ?? row.imageMimeType ?? null,
    imageUrl,
    isActive: row.is_active ?? row.isActive ?? true,
    createdBy: row.created_by ?? row.createdBy ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

export async function fetchShopMerchandise(options?: {
  includeInactive?: boolean;
  itemType?: ShopMerchandiseType;
  sex?: ShopMerchandiseSex;
}): Promise<ShopMerchandiseRecord[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("shop_merchandise")
    .select(
      "id, name, description, item_type, sex, sizes, image_path, image_name, image_mime_type, is_active, created_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }
  if (options?.itemType) {
    query = query.eq("item_type", options.itemType);
  }
  if (options?.sex) {
    query = query.eq("sex", options.sex);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeShopMerchandiseRow);
}

export async function createShopMerchandise(
  payload: CreateShopMerchandiseRequest
): Promise<ShopMerchandiseRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("shop_merchandise")
    .insert({
      name: payload.name,
      description: payload.description,
      item_type: payload.itemType,
      sex: payload.sex,
      sizes: payload.sizes,
      image_path: payload.imagePath ?? null,
      image_name: payload.imageName ?? null,
      image_mime_type: payload.imageMimeType ?? null,
      is_active: payload.isActive ?? true
    })
    .select(
      "id, name, description, item_type, sex, sizes, image_path, image_name, image_mime_type, is_active, created_by, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return normalizeShopMerchandiseRow(data);
}

export async function updateShopMerchandise(
  payload: UpdateShopMerchandiseRequest
): Promise<ShopMerchandiseRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("shop_merchandise")
    .update({
      name: payload.name,
      description: payload.description,
      item_type: payload.itemType,
      sex: payload.sex,
      sizes: payload.sizes,
      image_path: payload.imagePath ?? null,
      image_name: payload.imageName ?? null,
      image_mime_type: payload.imageMimeType ?? null,
      is_active: payload.isActive ?? true
    })
    .eq("id", payload.id)
    .select(
      "id, name, description, item_type, sex, sizes, image_path, image_name, image_mime_type, is_active, created_by, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return normalizeShopMerchandiseRow(data);
}

export async function deleteShopMerchandise(item: ShopMerchandiseRecord) {
  const supabase = getSupabaseClient();
  if (item.imagePath) {
    await supabase.storage.from(SHOP_BUCKET).remove([item.imagePath]);
  }
  const { error } = await supabase.from("shop_merchandise").delete().eq("id", item.id);
  if (error) throw error;
}

export async function uploadShopMerchandiseImage(file: File): Promise<{
  path: string;
  name: string;
  mimeType: string | null;
}> {
  const supabase = getSupabaseClient();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const filename = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const path = `catalog/${new Date().toISOString().slice(0, 10)}/${filename}`;
  const { error } = await supabase.storage.from(SHOP_BUCKET).upload(path, file, {
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
