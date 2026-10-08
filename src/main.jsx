import { createRoot } from "react-dom/client";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App.jsx";
import { SignInPage } from "./components/SignInPage.jsx";
import { RequireAuth } from "./components/RequireAuth.jsx";
import { msalConfig } from "./lib/authConfig.js";

if (import.meta.env.DEV) {
  // Local dev only: skip Microsoft sign-in entirely so the dashboard runs
  // without an Azure app registration configured. import.meta.env.DEV is
  // false for `vite build`/`vite preview` and on Vercel, so production
  // still goes through the real MSAL flow below.
  createRoot(document.getElementById("root")).render(<App />);
} else if (!msalConfig.auth.clientId || !import.meta.env.VITE_MICROSOFT_TENANT_ID) {
  createRoot(document.getElementById("root")).render(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Microsoft sign-in isn't configured</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Set <code>VITE_MICROSOFT_CLIENT_ID</code> and <code>VITE_MICROSOFT_TENANT_ID</code> in <code>.env</code>.
          See README.md &ldquo;Microsoft sign-in setup&rdquo;.
        </p>
      </div>
    </div>
  );
} else {
  runApp();
}

function runApp() {
  const msalInstance = new PublicClientApplication(msalConfig);
  const isSignInRoute = window.location.pathname === "/signin";

  msalInstance.initialize().then(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        msalInstance.setActiveAccount(event.payload.account);
      }
      if (event.eventType === EventType.LOGIN_FAILURE) {
        // MsalProvider swallows handleRedirectPromise errors internally, so this is the
        // only place a failed sign-in redirect surfaces. Log it and stash it so SignInPage
        // can show something other than a silent bounce back to the login button.
        const message = event.error?.errorMessage || event.error?.message || String(event.error);
        console.error("MSAL sign-in failed:", event.error);
        sessionStorage.setItem("msal_last_error", message);
      }
    });

    // NOTE: intentionally not wrapped in <StrictMode> — its dev-only double effect
    // invocation can cause MSAL's handleRedirectPromise to consume the auth response
    // before an account ever gets set, silently dropping the sign-in.
    createRoot(document.getElementById("root")).render(
      <MsalProvider instance={msalInstance}>
        {isSignInRoute ? (
          <SignInPage />
        ) : (
          <RequireAuth>
            <App />
          </RequireAuth>
        )}
      </MsalProvider>
    );
  });
}
