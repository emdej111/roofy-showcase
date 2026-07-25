// =============================================================================
// useSecurityLog — klijentski helper za pisanje u sigurnosni audit log
// =============================================================================
//
// SVRHA:
// Jednostavan API koji bilo gdje u aplikaciji pozivamo s `logSecurityEvent(...)`.
// Svaki poziv ide kroz edge funkciju `log-security-event` koja je jedini
// dopušteni put pisanja u `security_audit_log` tablicu (vidi komentar u
// edge funkciji za razloge).
//
// PHILOZOFIJA:
// - Fire-and-forget: nikad ne blokira UI ako logging padne.
// - Whitelist event tipova mora se podudarati s onim u edge funkciji.
// - Ne logiramo OSJETLJIVE PODATKE (lozinke, kodove, tokene) u metadata.
//
// O WAF/PROXY OGRANIČENJU (relevantno i za audit log):
// Pošto Lovable Cloud trenutno nema WAF/proxy ispred edge funkcija, napadač
// koji uspije ukrasti JWT mogao bi spamati log-security-event pozive. Edge
// funkcija ograničava veličinu metadate i validira event tipove, ali
// pravu obranu od distribuiranog spama dao bi tek Cloudflare/proxy ispred.
// Do tada: oslanjamo se na auto-cleanup (zapisi stariji od 365 dana se brišu)
// i činjenicu da svaki upis vrijedi malo CPU-a, ne MB-a podataka.
// =============================================================================

import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "logout_all_devices"
  | "password_changed"
  | "password_reset_requested"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_recovery_code_used"
  | "mfa_challenge_failed"
  | "profile_updated"
  | "email_changed"
  | "role_changed"
  | "account_banned"
  | "verification_submitted"
  | "verification_approved"
  | "verification_rejected";

/**
 * Bilježi sigurnosni događaj. Nikad ne baca grešku — logging ne smije
 * srušiti glavni flow. Ako pišemo s pre-auth događajem (login_failed,
 * password_reset_requested), proslijediti opcionalno `userId` u metadati.
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.functions.invoke("log-security-event", {
      body: { event_type: eventType, metadata },
    });
  } catch (err) {
    // Namjerno tiho — audit log je best-effort iz UX perspektive.
    // Ako želimo pratiti propade logginga, dodati Sentry ovdje.
    console.warn("[security-log] failed:", err);
  }
}
