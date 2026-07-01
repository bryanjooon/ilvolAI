// Background service worker - runs even when no tab is open
// Listens for keyboard shortcut and tells the active tab to toggle the panel

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_PANEL" });
      }
    });
  }
});
