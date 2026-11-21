import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.1";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(projectUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rayaand913-rgb.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function hashCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makeCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findHousehold(code: string) {
  if (!/^[0-9a-f]{64}$/.test(code)) return null;
  const hashed = await hashCode(code);
  const { data, error } = await admin
    .from("family_households")
    .select("id,name,created_at")
    .eq("invite_code_hash", hashed)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, codeHash: hashed } : null;
}

async function notifyFamily(codeHash: string) {
  try {
    await admin.channel("family-" + codeHash)
      .send({ type: "broadcast", event: "changed", payload: {} });
  } catch {
    // The edit is already saved; clients can still refresh the list manually.
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Use POST for this request." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request body must be valid JSON." }, 400);
  }

  const action = body.action;
  const inviteCode = String(body.inviteCode || "").toLowerCase();
  const household = await findHousehold(inviteCode).catch(() => null);
  if (!household) return json({ error: "That family invite link is not valid." }, 403);

  if (action === "load") {
    const { data, error } = await admin
      .from("family_chores")
      .select("id,chore_name,date_added,assigned_to,points,completed")
      .eq("household_id", household.id)
      .order("date_added", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return json({ error: "Could not load the family chores." }, 500);
    return json({ household: { id: household.id, name: household.name }, chores: data || [] });
  }

  if (action === "save") {
    const chore = body.chore as Record<string, unknown> | undefined;
    if (!chore) return json({ error: "A chore is required." }, 400);
    const id = String(chore.id || "");
    const choreName = String(chore.choreName || "").trim();
    const dateAdded = String(chore.dateAdded || "");
    const assignedTo = String(chore.assignedTo || "Anyone").trim() || "Anyone";
    const points = Number(chore.points);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "That chore could not be saved." }, 400);
    if (!choreName || choreName.length > 160) return json({ error: "Chore names must be 1 to 160 characters." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateAdded) || Number.isNaN(Date.parse(dateAdded + "T00:00:00Z"))) return json({ error: "Choose a valid date." }, 400);
    if (!assignedTo || assignedTo.length > 80) return json({ error: "Who can be assigned must be 1 to 80 characters." }, 400);
    if (!Number.isInteger(points) || points < 0 || points > 999999) return json({ error: "Points must be between 0 and 999,999." }, 400);

    const { error } = await admin.from("family_chores").upsert({
      household_id: household.id,
      id,
      chore_name: choreName,
      date_added: dateAdded,
      assigned_to: assignedTo,
      points,
      completed: Boolean(chore.completed)
    }, { onConflict: "household_id,id" });
    if (error) return json({ error: "Could not save that chore." }, 500);
    await notifyFamily(household.codeHash);
    return json({ ok: true });
  }

  if (action === "delete") {
    const choreId = String(body.choreId || "");
    if (!/^[0-9a-f-]{36}$/i.test(choreId)) return json({ error: "That chore could not be removed." }, 400);
    const { error } = await admin.from("family_chores")
      .delete().eq("household_id", household.id).eq("id", choreId);
    if (error) return json({ error: "Could not remove that chore." }, 500);
    await notifyFamily(household.codeHash);
    return json({ ok: true });
  }

  if (action === "rotate") {
    const newCode = makeCode();
    const { data, error } = await admin.from("family_households")
      .update({ invite_code_hash: await hashCode(newCode) })
      .eq("id", household.id)
      .select("id,name,created_at")
      .single();
    if (error) return json({ error: "Could not reset the family invite link." }, 500);
    return json({ household: data, inviteCode: newCode });
  }

  return json({ error: "That family list action is not supported." }, 400);
});
