"use client";

import { useEffect } from "react";

/**
 * OAuth 2.0 PKCE callback page.
 *
 * This page is opened in a popup by voice-cache-backup.ts during Google Drive
 * or Dropbox authentication. It extracts the authorization code from the URL
 * query string, posts it back to the opener window via postMessage, and closes.
 */
export default function OAuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth-callback", code, state, error },
        window.location.origin,
      );
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-base text-light">
      <p className="text-muted text-sm">
        Authenticating… this window will close automatically.
      </p>
    </div>
  );
}
