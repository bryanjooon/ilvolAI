// Popup script - tiny, just opens the panel on the active tab
document.getElementById("open-panel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    window.close();
  }
});
