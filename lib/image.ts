import type { SupabaseClient } from "@supabase/supabase-js";

/** Shrinks a phone screenshot or photo to max 1600px JPEG so uploads stay small and fast. */
export async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("That file could not be read as an image."))), "image/jpeg", 0.85)
  );
}

/** Private bucket: turn stored paths into short-lived viewing links. */
export async function signUrls(sb: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await sb.storage.from("screenshots").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}
