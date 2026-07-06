// ilvolAI content script
// Injects a floating button + loads the panel from panel.html.
// Panel only mounts once the user is signed in (JWT in storage).
// Listens for keyboard shortcut to toggle the panel.

(function () {
  if (window.__ilvolAI_loaded__) return;
  window.__ilvolAI_loaded__ = true;

  // ---- Floating button ----
  const btn = document.createElement("div");
  btn.id = "ilvolai-floating-btn";
  btn.title = "ilvolAI (⌘⇧L)";
  btn.textContent = "🚛";
  document.body.appendChild(btn);

  // ---- Load panel.html into the page ----
  // We use XHR to fetch the template so it works on file:// and any site.
  function mountPanel() {
    if (document.getElementById("ilvolai-panel")) return; // already mounted
    const xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.runtime.getURL("panel.html"), true);
    xhr.onload = () => {
      const wrap = document.createElement("div");
      wrap.innerHTML = xhr.responseText;
      document.body.appendChild(wrap.firstElementChild);
      // Now load the panel logic (which wires up form behavior + mic + paste)
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("panel.js");
      document.body.appendChild(script);
    };
    xhr.send();
  }

  function showSignedOutState() {
    // Show a small "sign in" prompt inline next to the floating button.
    // Only if the panel isn't already mounted.
    if (document.getElementById("ilvolai-signed-out-tip")) return;
    const tip = document.createElement("div");
    tip.id = "ilvolai-signed-out-tip";
    tip.textContent = "Sign in to use ilvolAI";
    tip.style.cssText = `
      position: fixed; bottom: 32px; right: 92px;
      background: #0f172a; color: #fff;
      padding: 6px 10px; border-radius: 6px;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(tip);
  }

  function hideSignedOutState() {
    document.getElementById("ilvolai-signed-out-tip")?.remove();
  }

  // ---- Auth gate ----
  function checkAuthAndMaybeMount() {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
      if (chrome.runtime.lastError) {
        // Background worker not ready — defer silently.
        return;
      }
      if (resp?.ok && resp.auth?.jwt) {
        hideSignedOutState();
        // Don't auto-mount — only mount when the user actually opens it.
      } else {
        showSignedOutState();
      }
    });
  }

  checkAuthAndMaybeMount();

  // ---- Toggle panel ----
  function togglePanel() {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
      if (!resp?.ok || !resp.auth?.jwt) {
        // Not signed in — surface a tip and bail.
        showSignedOutState();
        return;
      }
      const existing = document.getElementById("ilvolai-panel");
      if (existing) {
        existing.style.display = existing.style.display === "none" ? "flex" : "none";
        return;
      }
      mountPanel();
      // Wait a tick for panel.html to load, then show it.
      setTimeout(() => {
        const panel = document.getElementById("ilvolai-panel");
        if (panel) panel.style.display = "flex";
      }, 100);
    });
  }
  btn.addEventListener("click", togglePanel);

  // ---- Keyboard shortcut from background.js ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TOGGLE_PANEL") togglePanel();
  });
})();
