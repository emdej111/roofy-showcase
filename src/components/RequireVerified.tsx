import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Gate any route behind email-verified KYC approval.
 * Admins always pass through.
 */
export function RequireVerified({ children }: { children: ReactNode }) {
  const { user, role, verificationStatus, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (role === "admin") return <>{children}</>;
  if (verificationStatus !== "approved") return <Navigate to="/verify" replace />;
  return <>{children}</>;
}
