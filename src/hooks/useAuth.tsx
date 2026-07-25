import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "landlord" | "tenant" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type LandlordType = "private" | "agency";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  landlordType: LandlordType | null;
  verificationStatus: VerificationStatus | null;
  isVerified: boolean;
  avatarUrl: string | null;
  fullName: string | null;
  loading: boolean;
  refreshVerification: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [landlordType, setLandlordType] = useState<LandlordType | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileExtras = async (uid: string) => {
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase
        .from("profiles")
        .select("verification_status, landlord_type, avatar_url, full_name")
        .eq("id", uid)
        .maybeSingle(),
    ]);

    if (roleRow?.role) {
      setRole(roleRow.role as AppRole);
    } else {
      const pending = localStorage.getItem("pendingRole") as AppRole | null;
      if (pending === "landlord" || pending === "tenant") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: uid, role: pending });
        if (!insErr) {
          localStorage.removeItem("pendingRole");
          setRole(pending);
          if (pending === "landlord") {
            const lt = localStorage.getItem("pendingLandlordType");
            if (lt === "private" || lt === "agency") {
              await supabase.from("profiles").update({ landlord_type: lt }).eq("id", uid);
              setLandlordType(lt as LandlordType);
            }
            localStorage.removeItem("pendingLandlordType");
          }
        }
      }
    }

    setLandlordType(((profileRow as any)?.landlord_type as LandlordType) ?? null);
    setVerificationStatus(((profileRow as any)?.verification_status as VerificationStatus) ?? "pending");
    setAvatarUrl(((profileRow as any)?.avatar_url as string) ?? null);
    setFullName(((profileRow as any)?.full_name as string) ?? null);
  };

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchProfileExtras(sess.user.id), 0);
      } else {
        setRole(null);
        setLandlordType(null);
        setVerificationStatus(null);
        setAvatarUrl(null);
        setFullName(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await fetchProfileExtras(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshVerification = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle();
    setVerificationStatus(((data as any)?.verification_status as VerificationStatus) ?? "pending");
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfileExtras(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        landlordType,
        verificationStatus,
        isVerified: verificationStatus === "approved",
        avatarUrl,
        fullName,
        loading,
        refreshVerification,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
