import { Navigate } from "react-router-dom";

// The legacy landlord verification screen now redirects to the unified
// /verify flow used by all roles (tenant + landlord).
export default function Verification() {
  return <Navigate to="/verify" replace />;
}
