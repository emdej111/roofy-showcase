import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, MessageSquare, Inbox, Sparkles, Check, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotifications, NotificationRow } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

function iconFor(type: NotificationRow["type"]) {
  switch (type) {
    case "message":
      return <MessageSquare className="h-4 w-4 text-primary" />;
    case "inquiry":
      return <Inbox className="h-4 w-4 text-accent" />;
    case "saved_search_match":
      return <Sparkles className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, reload } = useNotifications();

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("notifications.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0
                ? t("notifications.unreadCount", { count: unreadCount })
                : t("notifications.allRead")}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="mr-1 h-4 w-4" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t("notifications.empty")}</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <Card
                  className={`flex items-start gap-3 p-4 transition-colors ${
                    !n.read_at ? "border-primary/40 bg-muted/20" : ""
                  }`}
                >
                  <div className="mt-0.5">{iconFor(n.type)}</div>
                  <button
                    onClick={() => handleClick(n)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDelete(n.id)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
