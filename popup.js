// Popup script — show sign-in or signed-in state, then let the user
// open the panel on the active tab.

const signedOut = document.getElementById("signed-out");
const signedIn = document.getElementById("signed-in");
const userInfo = document.getElementById("user-info");
const statusOut = document.getElementById("status-out");

const signInBtn = document.getElementById("sign-in");
const signOutBtn = document.getElementById("sign-out");
const openPanelBtn = document.getElementById("open-panel");

// ---- Auth state on popup open ----

chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
  if (chrome.runtime.lastError) {
    showSignedOut("Background worker not ready. Try again.");
    return;
  }
  if (resp?.ok && resp.auth?.jwt) {
    showSignedIn(resp.auth.user);
  } else {
    showSignedOut();
  }
});

function showSignedIn(user) {
  signedOut.style.display = "none";
  signedIn.style.display = "block";
  userInfo.innerHTML = `Signed in as <strong>${escapeHtml(user?.email || "unknown")}</strong>`;
}

function showSignedOut(err) {
  signedOut.style.display = "block";
  signedIn.style.display = "none";
  statusOut.textContent = err || "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---- Button handlers ----

signInBtn.addEventListener("click", async () => {
  signInBtn.disabled = true;
  signInBtn.textContent = "Signing in…";
  chrome.runtime.sendMessage({ type: "SIGN_IN" }, (resp) => {
    signInBtn.disabled = false;
    signInBtn.textContent = "Sign in with Google";
    if (resp?.ok) {
      showSignedIn(resp.user);
    } else {
      showSignedOut(resp?.error || "Sign in failed");
    }
  });
});

signOutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
    showSignedOut();
  });
});

openPanelBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    window.close();
  }
});
