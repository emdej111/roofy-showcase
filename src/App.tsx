import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireVerified } from "@/components/RequireVerified";

import "./i18n";

import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import LandlordDashboard from "./pages/landlord/Dashboard";
import ListingForm from "./pages/landlord/ListingForm";
import Analytics from "./pages/landlord/Analytics";
import Search from "./pages/tenant/Search";
import Favorites from "./pages/tenant/Favorites";
import SavedSearches from "./pages/tenant/SavedSearches";
import ListingDetail from "./pages/ListingDetail";
import Inbox from "./pages/Inbox";
import Notifications from "./pages/Notifications";
import Verification from "./pages/landlord/Verification";
import AdminVerifications from "./pages/admin/Verifications";
import AdminModeration from "./pages/admin/Moderation";
import LandlordProfile from "./pages/LandlordProfile";
import MapExplorer from "./pages/MapExplorer";
import TaxCalculator from "./pages/TaxCalculator";
import AdminTaxRates from "./pages/admin/TaxRates";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminDocuments from "./pages/admin/Documents";
import AdminUsers from "./pages/admin/Users";
import AdminPromoCodes from "./pages/admin/PromoCodes";
import LandlordMyMap from "./pages/landlord/MyMap";
import Verify from "./pages/Verify";
import Security from "./pages/Security";
import Account from "./pages/Account";
import RoommatesList from "./pages/roommates/List";
import RoommateDetail from "./pages/roommates/Detail";
import RoommateEdit from "./pages/roommates/Edit";
import PassportHome from "./pages/passport/Home";
import PassportEdit from "./pages/passport/Edit";
import PassportView from "./pages/passport/View";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/najam/:city/:slug" element={<ListingDetail />} />
            <Route path="/search" element={<RequireVerified><Search /></RequireVerified>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/explore" element={<MapExplorer />} />
            <Route path="/verify" element={<RequireAuth><Verify /></RequireAuth>} />
            <Route path="/security" element={<RequireAuth><Security /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="/tax-calculator" element={<RequireAuth role="landlord"><RequireVerified><TaxCalculator /></RequireVerified></RequireAuth>} />
            <Route path="/admin/tax-rates" element={<RequireAuth role="admin"><AdminTaxRates /></RequireAuth>} />
            <Route path="/landlord/:id/profile" element={<LandlordProfile />} />

            <Route path="/landlord" element={<RequireAuth role="landlord"><RequireVerified><LandlordDashboard /></RequireVerified></RequireAuth>} />
            <Route path="/landlord/analytics" element={<RequireAuth role="landlord"><RequireVerified><Analytics /></RequireVerified></RequireAuth>} />
            <Route path="/landlord/new" element={<RequireAuth role="landlord"><RequireVerified><ListingForm /></RequireVerified></RequireAuth>} />
            <Route path="/landlord/edit/:id" element={<RequireAuth role="landlord"><RequireVerified><ListingForm /></RequireVerified></RequireAuth>} />
            <Route path="/landlord/verification" element={<RequireAuth role="landlord"><Verification /></RequireAuth>} />
            <Route path="/landlord/map" element={<RequireAuth role="landlord"><RequireVerified><LandlordMyMap /></RequireVerified></RequireAuth>} />

            <Route path="/admin/verifications" element={<RequireAuth role="admin"><AdminVerifications /></RequireAuth>} />
            <Route path="/admin/moderation" element={<RequireAuth role="admin"><AdminModeration /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/documents" element={<RequireAuth role="admin"><AdminDocuments /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
            <Route path="/admin/promo-codes" element={<RequireAuth role="admin"><AdminPromoCodes /></RequireAuth>} />
            <Route path="/favorites" element={<RequireAuth role="tenant"><RequireVerified><Favorites /></RequireVerified></RequireAuth>} />
            <Route path="/saved-searches" element={<RequireAuth role="tenant"><RequireVerified><SavedSearches /></RequireVerified></RequireAuth>} />
            <Route path="/inbox" element={<RequireAuth><RequireVerified><Inbox /></RequireVerified></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

            <Route path="/roommates" element={<RequireAuth><RoommatesList /></RequireAuth>} />
            <Route path="/roommates/edit" element={<RequireAuth><RoommateEdit /></RequireAuth>} />
            <Route path="/roommates/:id" element={<RequireAuth><RoommateDetail /></RequireAuth>} />

            <Route path="/passport" element={<RequireAuth><PassportHome /></RequireAuth>} />
            <Route path="/passport/edit" element={<RequireAuth><PassportEdit /></RequireAuth>} />
            <Route path="/passport/:userId" element={<RequireAuth><PassportView /></RequireAuth>} />


            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
