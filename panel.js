// ilvolAI panel logic
// Handles conditional fields, form data collection, and stub actions.
// Designed so AI features (paste/mic) can call setLoadData() to auto-fill.

(function () {
  const root = document.getElementById("ilvolai-panel");
  const form = document.getElementById("ilvolai-form");

  // ---- Conditional field logic ----
  // Wires up any <select data-conditional="..."> to show/hide <div data-show-when="name=value">
  function wireConditionals() {
    const triggers = form.querySelectorAll("select[data-conditional]");
    triggers.forEach((trigger) => {
      const targetId = trigger.dataset.conditional;
      const target = root.querySelector(`[data-show-when]`);
      const apply = () => {
        const expected = `${trigger.name}=${trigger.value}`;
        if (target) target.hidden = target.dataset.showWhen !== expected;
      };
      trigger.addEventListener("change", apply);
      apply();
    });
  }

  // ---- Collect form data as a plain object ----
  function getLoadData() {
    const fd = new FormData(form);
    const data = {};
    for (const [key, value] of fd.entries()) {
      data[key] = typeof value === "string" ? value.trim() : value;
    }
    // Normalize numbers
    if (data.weight_lbs) data.weight_lbs = Number(data.weight_lbs);
    if (data.target_rate) data.target_rate = Number(data.target_rate);
    return data;
  }

  // ---- Set form data from a plain object (used by AI later) ----
  function setLoadData(data = {}) {
    Object.entries(data).forEach(([key, value]) => {
      const el = form.elements.namedItem(key);
      if (!el) return;
      if (typeof value === "number") el.value = value;
      else if (value == null) el.value = "";
      else el.value = value;
    });
    // Re-evaluate conditionals after values change
    form.querySelectorAll("select[data-conditional]").forEach((t) =>
      t.dispatchEvent(new Event("change"))
    );
  }

  // ---- Stub actions (real AI wiring comes next) ----
  function onPaste() {
    alert("Paste-from-clipboard + AI extraction is the next feature we'll build!");
  }
  function onMic() {
    alert("Mic recording + AI extraction comes after the form is locked in.");
  }
  function onCopy() {
    const data = getLoadData();
    const text = formatDriverMessage(data);
    navigator.clipboard.writeText(text).then(() => {
      flashButton("📤 Copied!");
    });
  }

  // Placeholder — we'll polish this once you give feedback on tone
  function formatDriverMessage(d) {
    return `Load details:
PU: ${d.pickup_city || "?"}, ${d.pickup_state || "?"} @ ${d.pickup_date || "?"} ${d.pickup_time || ""}
DEL: ${d.delivery_city || "?"}, ${d.delivery_state || "?"} @ ${d.delivery_date || "?"} ${d.delivery_time || ""}
Commodity: ${d.commodity || "?"}
Weight: ${d.weight_lbs || "?"} lbs
Rate: $${d.target_rate || "?"}
Notes: ${d.notes || "—"}`;
  }

  function flashButton(label) {
    const btn = root.querySelector(".ilvolai-btn-copy");
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => (btn.textContent = original), 1200);
  }

  // ---- Wire up static controls ----
  root.querySelector(".ilvolai-close").addEventListener("click", () => {
    root.style.display = "none";
  });
  root.querySelector(".ilvolai-btn-paste").addEventListener("click", onPaste);
  root.querySelector(".ilvolai-btn-mic").addEventListener("click", onMic);
  root.querySelector(".ilvolai-btn-copy").addEventListener("click", onCopy);

  // Enable copy button once user has touched any field
  form.addEventListener("input", () => {
    root.querySelector(".ilvolai-btn-copy").disabled = false;
  });

  wireConditionals();

  // Expose API for AI code to call
  window.__ilvolAI__ = { getLoadData, setLoadData, open: () => (root.style.display = "flex") };
})();
