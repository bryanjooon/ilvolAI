// Background service worker for ilvolAI.
//
// Responsibilities:
//   - Toggle the side panel via keyboard shortcut (existing).
//   - Get a Google ID token via chrome.identity.getAuthToken() and
//     exchange it for our backend JWT (stored in chrome.storage.local).
//   - Sign-out: clear cached tokens.
//
// chrome.identity.getAuthToken() is the simplest path for Chrome extensions:
// Google handles the OAuth dance, returns an ID token, we forward it to
// our backend which mints our own short-lived JWT for /extract calls.

const BACKEND_URL = "https://ilvolai-backend.REPLACE_ME.workers.dev";

// ---- Keyboard shortcut: toggle panel ----

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_PANEL" });
      }
    });
  }
});

// ---- Token storage helpers ----

async function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["ilvolai_jwt", "ilvolai_user"], (data) => {
      resolve({
        jwt: data.ilvolai_jwt || null,
        user: data.ilvolai_user || null,
      });
    });
  });
}

async function setStoredAuth(jwt, user) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ ilvolai_jwt: jwt, ilvolai_user: user }, resolve);
  });
}

async function clearStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["ilvolai_jwt", "ilvolai_user"], resolve);
  });
}

// ---- Sign-in flow ----
//
// 1. chrome.identity.getAuthToken({ interactive: true }) — Google handles
//    the OAuth dance if needed, returns an ID token (or OAuth access
//    token — see note below).
// 2. POST it to our backend /auth/google to mint our own JWT.
// 3. Store the JWT in chrome.storage.local for later /extract calls.
//
// Note: getAuthToken() returns an OAuth access token by default, not an
// ID token. For our backend to verify the user, we need the ID token. We
// can either:
//   a) Use launchWebAuthFlow with a custom OAuth client (more setup)
//   b) Use getAuthToken and call Google's userinfo endpoint to identify
//      the user (we'd lose "verified email" guarantee)
//   c) Use launchWebAuthFlow with response_type=id_token (cleanest for
//      a backend that just needs the user identity)
//
// We use (c) — launchWebAuthFlow with the Google OAuth discovery URL,
// response_type=id_token, so the redirect gives us a JWT ID token
// directly. Our backend verifies it via Google's tokeninfo endpoint.

async function signIn() {
  // Discover Google's OAuth endpoints so the auth URL is correct.
  const discovery = await fetch(
    "https://accounts.google.com/.well-known/openid-configuration"
  ).then((r) => r.json());

  const redirectUrl = chrome.identity.getRedirectURL();
  const clientId = chrome.runtime.getManifest().oauth2.client_id;

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "id_token");
  authUrl.searchParams.set("redirect_uri", redirectUrl);
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("nonce", crypto.randomUUID());

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message || "auth flow failed"));
        } else {
          resolve(url);
        }
      }
    );
  });

  // The redirect URL has the id_token in the fragment: ...#id_token=...&...
  const fragment = responseUrl.split("#")[1] || "";
  const params = new URLSearchParams(fragment);
  const idToken = params.get("id_token");
  if (!idToken) throw new Error("no id_token in auth response");

  // Exchange the Google ID token for our own JWT.
  const r = await fetch(`${BACKEND_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`backend /auth/google failed: ${r.status} ${err}`);
  }
  const { token, user } = await r.json();
  await setStoredAuth(token, user);
  return user;
}

async function signOut() {
  await clearStoredAuth();
}

// ---- Message router for popup / content scripts ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Promise-returning handler — we set up an async closure.
  (async () => {
    try {
      switch (msg?.type) {
        case "GET_AUTH":
          sendResponse({ ok: true, auth: await getStoredAuth() });
          break;
        case "SIGN_IN":
          sendResponse({ ok: true, user: await signIn() });
          break;
        case "SIGN_OUT":
          await signOut();
          sendResponse({ ok: true });
          break;
        case "TOGGLE_PANEL":
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_PANEL" });
            }
          });
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true; // Tell Chrome we'll respond asynchronously.
});
