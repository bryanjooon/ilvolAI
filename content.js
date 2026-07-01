// ilvolAI content script
// Injects a floating button + loads the panel from panel.html.
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
  // We use a <link> for the template fetch so it works on file:// and any site.
  const link = document.createElement("link");
  link.rel = "stylesheet";
  // We'll fetch the HTML via XHR since <link> can't load HTML
  const xhr = new XMLHttpRequest();
  xhr.open("GET", chrome.runtime.getURL("panel.html"), true);
  xhr.onload = () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = xhr.responseText;
    document.body.appendChild(wrap.firstElementChild);
    // Now load the panel logic (which wires up form behavior)
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("panel.js");
    document.body.appendChild(script);
  };
  xhr.send();

  // ---- Toggle panel ----
  function togglePanel() {
    const panel = document.getElementById("ilvolai-panel");
    if (!panel) return; // panel still loading
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  }
  btn.addEventListener("click", togglePanel);

  // ---- Keyboard shortcut from background.js ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TOGGLE_PANEL") togglePanel();
  });
})();
