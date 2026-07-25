import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Send, MessageSquare, Check, X, Archive, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InquirySummary } from "@/components/InquiryForm";
import { ReviewCounterpartyDialog } from "@/components/ReviewCounterpartyDialog";

type InquiryStatus = "pending" | "accepted" | "declined" | "archived";

type ThreadRow = {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  message: string | null;
  move_in_date: string | null;
  budget_max: number | null;
  household_size: number | null;
  rental_period_months: number | null;
  pets: boolean | null;
  employment_status: string | null;
  updated_at: string;
  created_at: string;
  status: InquiryStatus;
  closed_at: string | null;
  landlord_archived: boolean;
  tenant_archived: boolean;
  listing: { id: string; title: string; city: string } | null;
  tenant: { id: string; full_name: string | null } | null;
  landlord: { id: string; full_name: string | null } | null;
};

type Message = {
  id: string;
  inquiry_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function Inbox() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(params.get("id"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load threads
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const baseSel = "id, listing_id, tenant_id, landlord_id, message, move_in_date, budget_max, household_size, rental_period_months, pets, employment_status, updated_at, created_at, status, closed_at, landlord_archived, tenant_archived";
      const { data } = await supabase
        .from("inquiries")
        .select(
          `${baseSel}, listing:listings(id,title,city), tenant:profiles!inquiries_tenant_id_fkey(id,full_name), landlord:profiles!inquiries_landlord_id_fkey(id,full_name)`
        )
        .order("updated_at", { ascending: false });
      // The FK alias above may not exist; fallback to manual join if needed
      let rows = (data as unknown as ThreadRow[]) ?? [];
      if (!rows.length || !rows[0]?.tenant) {
        const { data: raw } = await supabase
          .from("inquiries")
          .select(`${baseSel}, listing:listings(id,title,city)`)
          .order("updated_at", { ascending: false });
        const list = (raw as unknown as ThreadRow[]) ?? [];
        const ids = Array.from(new Set(list.flatMap((r) => [r.tenant_id, r.landlord_id])));
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows = list.map((r) => ({
          ...r,
          tenant: (map.get(r.tenant_id) as { id: string; full_name: string | null }) ?? null,
          landlord: (map.get(r.landlord_id) as { id: string; full_name: string | null }) ?? null,
        }));
      }
      setThreads(rows);
      if (!activeId && rows[0]) setActiveId(rows[0].id);
      setLoading(false);
    })();
  }, [user]);

  // Load messages for active thread + realtime
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setParams({ id: activeId }, { replace: true });
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("inquiry_id", activeId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      // mark unread (addressed to me) as read
      if (user) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("inquiry_id", activeId)
          .neq("sender_id", user.id)
          .is("read_at", null);
      }
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `inquiry_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  const counterpart = (th: ThreadRow) =>
    user?.id === th.landlord_id ? th.tenant?.full_name : th.landlord?.full_name;

  const send = async () => {
    if (!user || !activeId) return;
    const text = body.trim();
    if (text.length < 1) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ inquiry_id: activeId, sender_id: user.id, body: text });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
  };

  const [showArchived, setShowArchived] = useState(false);

  const visibleThreads = useMemo(() => {
    if (!user) return [];
    return threads.filter((th) => {
      const isLandlord = th.landlord_id === user.id;
      const archivedForMe = isLandlord ? th.landlord_archived : th.tenant_archived;
      return showArchived ? archivedForMe : !archivedForMe;
    });
  }, [threads, showArchived, user]);

  const updateInquiry = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("inquiries").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...(patch as Partial<ThreadRow>) } : t)));
  };

  const handleAccept = (th: ThreadRow) =>
    updateInquiry(th.id, { status: "accepted" }).then(() => toast.success(t("inquiry.accepted")));
  const handleDecline = (th: ThreadRow) =>
    updateInquiry(th.id, { status: "declined" }).then(() => toast.success(t("inquiry.declined")));
  const handleArchive = (th: ThreadRow) => {
    const isLandlord = th.landlord_id === user!.id;
    const patch = isLandlord ? { landlord_archived: true } : { tenant_archived: true };
    updateInquiry(th.id, patch).then(() => {
      toast.success(t("inquiry.archived"));
      if (activeId === th.id) setActiveId(null);
    });
  };
  const handleUnarchive = (th: ThreadRow) => {
    const isLandlord = th.landlord_id === user!.id;
    const patch = isLandlord ? { landlord_archived: false } : { tenant_archived: false };
    updateInquiry(th.id, patch);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <h1 className="mb-4 text-2xl font-bold">{t("inbox.title")}</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">{t("inbox.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            {/* Thread list */}
            <aside className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowArchived(false)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      !showArchived ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t("inbox.tabActive")}
                  </button>
                  <button
                    onClick={() => setShowArchived(true)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      showArchived ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t("inbox.tabArchived")}
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{visibleThreads.length}</span>
              </div>
              <ul className="max-h-[calc(70vh-44px)] divide-y divide-border overflow-y-auto">
                {visibleThreads.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">{t("inbox.emptyFolder")}</li>
                )}
                {visibleThreads.map((th) => (
                  <li key={th.id}>
                    <button
                      onClick={() => setActiveId(th.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition hover:bg-muted/50",
                        activeId === th.id && "bg-muted"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium">{counterpart(th) || "—"}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(th.updated_at).toLocaleDateString("hr-HR")}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {th.listing?.title}
                      </p>
                      <div className="mt-1.5">
                        <InquiryStatusPill status={th.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Thread view */}
            <section className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
              {activeThread ? (
                <>
                  <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{counterpart(activeThread) || "—"}</p>
                        <InquiryStatusPill status={activeThread.status} />
                      </div>
                      <Link
                        to={`/listing/${activeThread.listing_id}`}
                        className="truncate text-xs text-primary hover:underline"
                      >
                        {activeThread.listing?.title}
                      </Link>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {user.id === activeThread.landlord_id && activeThread.status === "pending" && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleAccept(activeThread)}>
                            <Check className="h-4 w-4" />{t("inquiry.accept")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecline(activeThread)}>
                            <X className="h-4 w-4" />{t("inquiry.decline")}
                          </Button>
                        </>
                      )}
                      {(activeThread.status === "accepted" || activeThread.status === "declined") && (
                        <ReviewCounterpartyDialog
                          inquiryId={activeThread.id}
                          tenantId={activeThread.tenant_id}
                          landlordId={activeThread.landlord_id}
                          listingId={activeThread.listing_id}
                        />
                      )}
                      {((user.id === activeThread.landlord_id && !activeThread.landlord_archived) ||
                        (user.id === activeThread.tenant_id && !activeThread.tenant_archived)) && (
                        <Button size="sm" variant="ghost" onClick={() => handleArchive(activeThread)}>
                          <Archive className="h-4 w-4" />{t("inquiry.archive")}
                        </Button>
                      )}
                      {((user.id === activeThread.landlord_id && activeThread.landlord_archived) ||
                        (user.id === activeThread.tenant_id && activeThread.tenant_archived)) && (
                        <Button size="sm" variant="ghost" onClick={() => handleUnarchive(activeThread)}>
                          {t("inquiry.unarchive")}
                        </Button>
                      )}
                    </div>
                  </header>

                  <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                    {/* Structured inquiry summary (visible to landlord especially) */}
                    <InquirySummary inquiry={activeThread} />
                    {/* Original inquiry message (if any) */}
                    {activeThread.message && (
                      <Bubble
                        mine={user.id === activeThread.tenant_id}
                        body={activeThread.message}
                        ts={activeThread.created_at}
                      />
                    )}
                    {messages.map((m) => (
                      <Bubble key={m.id} mine={m.sender_id === user.id} body={m.body} ts={m.created_at} />
                    ))}
                  </div>

                  <div className="border-t border-border p-3">
                    <div className="flex items-end gap-2">
                      <Textarea
                        rows={2}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        placeholder={t("inbox.placeholder")}
                        maxLength={4000}
                        className="resize-none"
                      />
                      <Button onClick={send} disabled={sending || !body.trim()}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                  {t("inbox.select")}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ mine, body, ts }: { mine: boolean; body: string; ts: string }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-soft",
          mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card"
        )}
      >
        <p className="whitespace-pre-line break-words">{body}</p>
        <p className={cn("mt-1 text-[10px] opacity-70", mine ? "text-right" : "")}>
          {new Date(ts).toLocaleString("hr-HR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function InquiryStatusPill({ status }: { status: InquiryStatus }) {
  const { t } = useTranslation();
  const cfg: Record<InquiryStatus, { icon: typeof Clock; cls: string; label: string }> = {
    pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: t("inquiry.statusPending") },
    accepted: { icon: CheckCircle2, cls: "bg-primary/15 text-primary", label: t("inquiry.statusAccepted") },
    declined: { icon: XCircle, cls: "bg-destructive/15 text-destructive", label: t("inquiry.statusDeclined") },
    archived: { icon: Archive, cls: "bg-muted text-muted-foreground", label: t("inquiry.statusArchived") },
  };
  const { icon: Icon, cls, label } = cfg[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
