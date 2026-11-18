"use server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; message: string } | null;

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("You are signed out. Sign in again.");
  const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") throw new Error("Only admins can do this.");
  return user;
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Add it in Vercel > Settings > Environment Variables, then redeploy.");
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function createManager(_prev: Result, formData: FormData): Promise<Result> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!name || !email) return { ok: false, message: "Enter a name and an email." };
    if (password.length < 8) return { ok: false, message: "The password needs at least 8 characters." };
    const { error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/team");
    return { ok: true, message: `${name} can now sign in with ${email}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteManager(id: string): Promise<Result> {
  try {
    const me = await requireAdmin();
    if (me.id === id) return { ok: false, message: "You can't remove your own account." };
    const sb = await createClient();
    const { data: target } = await sb.from("profiles").select("role").eq("id", id).single();
    if (target?.role === "admin") return { ok: false, message: "Admin accounts can't be removed here." };
    const { error } = await adminClient().auth.admin.deleteUser(id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/team");
    return { ok: true, message: "Manager removed. Their past entries are kept." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function createServiceUser(_prev: Result, formData: FormData): Promise<Result> {
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const serviceId = Number(formData.get("service_id"));
    if (!name || !email || !serviceId) return { ok: false, message: "Choose a service and enter a name and an email." };
    if (password.length < 8) return { ok: false, message: "The password needs at least 8 characters." };
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) return { ok: false, message: error?.message ?? "Could not create the login." };
    const { error: upErr } = await admin.from("profiles").update({ role: "service", service_id: serviceId, full_name: name }).eq("id", data.user.id);
    if (upErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, message: upErr.message };
    }
    revalidatePath("/team");
    return { ok: true, message: `${name} can now sign in at the same address and will land on the Services portal.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
