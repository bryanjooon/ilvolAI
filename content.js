// ilvolAI content script
// This runs on every webpage. It creates the floating button and panel.

(function () {
  // Don't inject twice if script re-runs
  if (window.__ilvolAI_loaded__) return;
  window.__ilvolAI_loaded__ = true;

  let panelOpen = false;
  let panelEl = null;
  let floatBtnEl = null;

  // ---- Floating button (the bubble) ----
  function createFloatingButton() {
    const btn = document.createElement("div");
    btn.id = "ilvolai-floating-btn";
    btn.title = "ilvolAI (⌘⇧L)";
    btn.innerHTML = "🚛";
    btn.addEventListener("click", togglePanel);
    document.body.appendChild(btn);
    floatBtnEl = btn;
  }

  // ---- Main panel ----
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "ilvolai-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="ilvolai-header">
        <span class="ilvolai-title">🚛 ilvolAI</span>
        <button class="ilvolai-close" aria-label="Close">×</button>
      </div>
      <div class="ilvolai-body">
        <p class="ilvolai-hint">Panel is empty for now. Real load fields coming next.</p>
        <div class="ilvolai-actions">
          <button class="ilvolai-btn ilvolai-btn-paste">📋 Paste from clipboard</button>
          <button class="ilvolai-btn ilvolai-btn-mic">🎤 Start listening</button>
        </div>
        <div class="ilvolai-actions">
          <button class="ilvolai-btn ilvolai-btn-copy" disabled>📤 Copy driver message</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panelEl = panel;

    panel.querySelector(".ilvolai-close").addEventListener("click", togglePanel);
    panel.querySelector(".ilvolai-btn-paste").addEventListener("click", onPasteClick);
    panel.querySelector(".ilvolai-btn-mic").addEventListener("click", onMicClick);
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    if (panelEl) {
      panelEl.style.display = panelOpen ? "flex" : "none";
    }
  }

  // ---- Stub handlers (we'll wire these up properly next) ----
  function onPasteClick() {
    alert("Paste-from-clipboard is not wired up yet — next step!");
  }
  function onMicClick() {
    alert("Mic listening is not wired up yet — coming after the form fields!");
  }

  // ---- Listen for the keyboard shortcut message from background.js ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TOGGLE_PANEL") togglePanel();
  });

  // ---- Init ----
  createFloatingButton();
  createPanel();
})();
