import { Bell, MessageSquare, Inbox, Sparkles, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, NotificationRow } from "@/hooks/useNotifications";
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

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={t("notifications.title")}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 z-[1200]">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              <Check className="mr-1 h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                      !n.read_at ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="mt-0.5">{iconFor(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border px-3 py-2">
          <Link to="/notifications" className="text-xs text-primary hover:underline">
            {t("notifications.viewAll")}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
