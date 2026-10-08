import { useEffect, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { T } from "../constants/theme";
import { loginRequest, isAllowedEmail, ALLOWED_EMAIL_DOMAINS } from "../lib/authConfig";
import mainLogo from "../logos/Main Logo.png";

// Standalone page served at /signin. Once a signed-in, allowed-domain account
// is present it redirects to "/" (the dashboard) itself.
export function SignInPage() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loginError, setLoginError] = useState(() => sessionStorage.getItem("msal_last_error"));

  const account = accounts[0];
  const email = account?.username;
  const allowed = isAuthenticated && email && isAllowedEmail(email);
  const denied = isAuthenticated && email && !isAllowedEmail(email);

  useEffect(() => {
    if (allowed) {
      window.location.replace("/");
    }
  }, [allowed]);

  const handleLogin = () => {
    sessionStorage.removeItem("msal_last_error");
    setLoginError(null);
    instance.loginRedirect(loginRequest);
  };
  const handleSwitchAccount = () => instance.logoutRedirect();

  const starting = inProgress === InteractionStatus.Startup;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bgPage,
    }}>
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16,
        boxShadow: T.shadowMd, padding: "40px 36px", width: 360, textAlign: "center",
      }}>
        <img src={mainLogo} alt="Adage" style={{ height: 40, marginBottom: 24 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary, margin: "0 0 8px" }}>
          Adage Field Service Dashboard
        </h1>
        <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 24px" }}>
          Sign in with your Adage Microsoft account to continue.
        </p>

        {denied && (
          <div style={{
            background: T.dangerBg, color: "#B91C1C", borderRadius: 8, padding: "10px 12px",
            fontSize: 12.5, marginBottom: 16, textAlign: "left",
          }}>
            <strong>{email}</strong> isn't allowed to access this dashboard.
            Sign in with an account on {ALLOWED_EMAIL_DOMAINS.join(" or ")}.
          </div>
        )}

        {!denied && loginError && (
          <div style={{
            background: T.dangerBg, color: "#B91C1C", borderRadius: 8, padding: "10px 12px",
            fontSize: 12.5, marginBottom: 16, textAlign: "left",
          }}>
            Sign-in failed: {loginError}
          </div>
        )}

        {starting || allowed ? (
          <div style={{ fontSize: 13, color: T.textMuted, padding: "10px 0" }}>Loading…</div>
        ) : denied ? (
          <button
            onClick={handleSwitchAccount}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 8, border: "none",
              background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Use a different account
          </button>
        ) : (
          <button
            onClick={handleLogin}
            disabled={inProgress !== InteractionStatus.None}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 8, border: "none",
              background: T.accent, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: inProgress !== InteractionStatus.None ? "default" : "pointer",
              opacity: inProgress !== InteractionStatus.None ? 0.7 : 1,
            }}
          >
            {inProgress !== InteractionStatus.None ? "Signing in…" : "Sign in with Microsoft"}
          </button>
        )}
      </div>
    </div>
  );
}
