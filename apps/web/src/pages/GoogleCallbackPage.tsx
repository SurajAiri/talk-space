// import { useEffect } from "react";
// import { useNavigate } from "react-router";
// import { toast } from "sonner";
// import { useAuthStore } from "../store/auth.store";

// /** The API redirects here with our JWT in the URL fragment: /auth/callback#token=... */
// export default function GoogleCallbackPage() {
//   const navigate = useNavigate();
//   const setToken = useAuthStore((s) => s.setToken);

//   useEffect(() => {
//     const token = new URLSearchParams(window.location.hash.slice(1)).get(
//       "token",
//     );
//     console.log("GoogleCallbackPage token", token);
//     if (!token) {
//       // toast.error('Google login failed')
//       toast.error("Google login failed; no token received");
//       navigate("/auth", { replace: true });
//       return;
//     }
//     // drop the token from the address bar / history
//     window.history.replaceState(null, "", window.location.pathname);
//     void setToken(token).then(() => navigate("/home", { replace: true }));
//   }, [navigate, setToken]);

//   return <div className="center-screen">Signing you in…</div>;
// }

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuthStore } from "../store/auth.store";

/** The API redirects here with our JWT in the URL fragment: /auth/callback#token=... */
export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);

  // read the token once, before the effect strips it from the URL
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get("token"),
  );
  // StrictMode runs effects twice in dev; make sure we only handle the token once
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (!token) {
      toast.error("Google login failed; no token received");
      navigate("/auth", { replace: true });
      return;
    }

    // drop the token from the address bar / history
    window.history.replaceState(null, "", window.location.pathname);
    void setToken(token).then(() => navigate("/home", { replace: true }));
  }, [token, navigate, setToken]);

  return <div className="center-screen">Signing you in…</div>;
}
