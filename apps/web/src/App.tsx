import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useTheme } from "@/hooks/useTheme";
import LayoutRoute from "@/components/LayoutRoute";
import Home from "@/pages/Home";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import TermsAndConditions from "@/pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Blog from "./pages/Blog";
import Share from "./pages/Share";
import CallSettings from "./pages/CallSettings";
import CallMonitoring from "./pages/CallMonitoring";

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
          {/* Routes with navigation layout */}
          <Route path="/" element={<LayoutRoute />}>
            <Route index element={<Home />} />
            <Route path="terms" element={<TermsAndConditions />} />
            <Route path="privacy" element={<PrivacyPolicy />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<Blog />} />
            <Route path="call-settings" element={<CallSettings />} />
            <Route path="call-monitoring" element={<CallMonitoring />} />
            <Route path="other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
          </Route>
          
          {/* Routes with custom background layout */}
          <Route path="/share" element={<LayoutRoute className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" />}>
            <Route path=":shareId" element={<Share />} />
          </Route>
          
          {/* Routes without navigation */}
          <Route path="/sign-in/*" element={<SignIn />} />
          <Route path="/sign-up/*" element={<SignUp />} />
        </Routes>
      </Router>
    </div>
  );
}
