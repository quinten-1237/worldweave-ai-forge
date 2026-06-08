import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SIGN_TTL = 60 * 60 * 24 * 365; // 1 year

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "invalid_type";
  if (file.size > MAX_IMAGE_BYTES) return "too_large";
  return null;
}

export async function uploadImage(opts: {
  bucket: "avatars" | "user-uploads";
  userId: string;
  file: File;
  fileName?: string;
}): Promise<{ path: string; url: string }> {
  const ext = opts.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const name = opts.fileName ?? `${crypto.randomUUID()}.${ext}`;
  const path = `${opts.userId}/${name}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, opts.file, {
    upsert: true, contentType: opts.file.type,
  });
  if (error) throw error;
  const url = await signedUrl(opts.bucket, path);
  return { path, url };
}

export async function signedUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_TTL);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFromStorage(bucket: "avatars" | "user-uploads", path: string) {
  await supabase.storage.from(bucket).remove([path]);
}

/** Parse the storage path out of a signed URL produced by Supabase. */
export function pathFromSignedUrl(url: string, bucket: string): string | null {
  const m = url.match(new RegExp(`/object/sign/${bucket}/([^?]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
