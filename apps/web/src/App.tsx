import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import {
  NotOnboardedRoute,
  OnboardedRoute,
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/RouteGuards";
import AuthPage from "./pages/AuthPage";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import LobbyPage from "./pages/LobbyPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import RoomPage from "./pages/RoomPage";
import { useAuthStore } from "./store/auth.store";
import LandingPage from "./pages/LandingPage";

// Dev-only map editor. `import.meta.env.DEV` is a build-time constant, so production bundles
// contain neither this route nor the editor code.
const MapEditorPage = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/MapEditorPage"))
  : null;

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    // skip on the Google callback page, which sets the token itself
    if (!window.location.pathname.startsWith("/auth/callback")) void loadUser();
  }, [loadUser]);

  // Tokens are short-lived (1 h). Swap for a fresh one well before expiry, and again when the
  // tab wakes up after a long sleep, so people are never logged out in the middle of a conversation.
  useEffect(() => {
    const refresh = () => void useAuthStore.getState().refresh();
    const timer = setInterval(refresh, 20 * 60 * 1000);
    let last = Date.now();
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - last > 20 * 60 * 1000
      ) {
        last = Date.now();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={useAuthStore.getState().user ? "/home" : "/landing"}
              replace
            />
          }
        />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/auth/callback" element={<GoogleCallbackPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<NotOnboardedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          {/* everything below needs the onboarding questions answered first */}
          <Route element={<OnboardedRoute />}>
            <Route path="/home" element={<LobbyPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
          </Route>
        </Route>
        {MapEditorPage && (
          <Route
            path="/dev/maps"
            element={
              <Suspense fallback={null}>
                <MapEditorPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Toaster richColors theme="system" position="top-right" />
    </BrowserRouter>
  );
}
