import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: AppRole;
}) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (role && userRole && userRole !== role) {
    return <Navigate to={userRole === "landlord" ? "/landlord" : "/search"} replace />;
  }
  return <>{children}</>;
}
