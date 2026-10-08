import { useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { T } from "../constants/theme";
import { isAllowedEmail } from "../lib/authConfig";

// Guards the dashboard route ("/"). Sends anyone who isn't signed in with an
// allowed-domain account to /signin.
export function RequireAuth({ children }) {
  const { accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const account = accounts[0];
  const email = account?.username;
  const allowed = isAuthenticated && email && isAllowedEmail(email);
  const settled = inProgress === InteractionStatus.None;

  useEffect(() => {
    if (settled && !allowed) {
      window.location.replace("/signin");
    }
  }, [settled, allowed]);

  if (!allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bgPage, color: T.textMuted, fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return children;
}
