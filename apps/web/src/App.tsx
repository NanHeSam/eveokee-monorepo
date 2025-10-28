import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useTheme } from "@/hooks/useTheme";
import LayoutRoute from "@/components/LayoutRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import Home from "@/pages/Home";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import TermsAndConditions from "@/pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Blog from "./pages/Blog";
import Share from "./pages/Share";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

/**
 * Initializes the global theme and renders the application's top-level UI, including global toast notifications and the routing structure.
 *
 * @returns The root React element for the application
 */
export default function App() {
  // Initialize theme globally
  useTheme();

  return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--toast-bg, #fff)",
              color: "var(--toast-color, #363636)",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#fff",
              },
            },
          }}
        />
        <Router>
          <Routes>
            {/* Public routes with marketing navigation */}
            <Route path="/" element={<LayoutRoute />} errorElement={<RouteErrorBoundary />}>
              <Route index element={<Home />} />
              <Route path="terms" element={<TermsAndConditions />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<Blog />} />
            </Route>
            
            {/* Dashboard routes with authenticated navigation */}
            <Route path="/dashboard" element={<DashboardLayout />} errorElement={<RouteErrorBoundary />}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            
            {/* Routes with custom background layout */}
            <Route path="/share" element={<LayoutRoute className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" />} errorElement={<RouteErrorBoundary />}>
              <Route path=":shareId" element={<Share />} />
            </Route>
            
            {/* Routes without navigation */}
            <Route path="/sign-in/*" element={<SignIn />} errorElement={<RouteErrorBoundary />} />
            <Route path="/sign-up/*" element={<SignUp />} errorElement={<RouteErrorBoundary />} />
            
            {/* 404 Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </div>
  );
}