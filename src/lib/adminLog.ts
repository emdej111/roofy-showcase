import { supabase } from "@/integrations/supabase/client";

/**
 * Record an admin moderation action in the audit log.
 * Caller must already be authenticated as an admin.
 */
export async function logAdminAction(params: {
  adminId: string;
  action: string; // e.g. "hide_listing", "ban_user", "delete_review"
  targetType: "listing" | "user" | "review" | "report";
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("admin_actions").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason ?? null,
    metadata: (params.metadata ?? {}) as never,
  });
  if (error) {
    // Non-fatal: log but don't block the moderation action.
    console.warn("Failed to log admin action:", error.message);
  }
}
