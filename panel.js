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

  // Format a date as DD/MM/YYYY with optional (today) / (tomorrow) label.
  // `dateStr` is in the form input's native format (YYYY-MM-DD).
  function fmtDate(dateStr) {
    if (!dateStr) return "?";
    // Parse as local date (avoid UTC shift from new Date(iso))
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return dateStr;
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const base = `${dd}/${mm}/${y}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dt - today) / 86400000);
    let tag = "";
    if (diffDays === 0) tag = " (today)";
    else if (diffDays === 1) tag = " (tomorrow)";
    else if (diffDays === -1) tag = " (yesterday)";
    return base + tag;
  }

  function fmtLocation(city, state) {
    if (city && state) return `${city}, ${state}`;
    return city || state || "?";
  }

  // Driver-ready message — dumb-driver friendly, no jargon, no abbreviations they won't know
  function formatDriverMessage(d) {
    const lines = [];
    lines.push(`🚛 LOAD DETAILS`);
    lines.push(``);
    lines.push(`PICK UP:`);
    lines.push(`  ${fmtLocation(d.pickup_city, d.pickup_state)}`);
    lines.push(`  ${fmtDate(d.pickup_date)} at ${d.pickup_time || "?"}`);

    if (d.pickup_empty === "yes" && (d.pickup_empty_city || d.pickup_empty_state)) {
      lines.push(`  ⚠️ Empty from: ${fmtLocation(d.pickup_empty_city, d.pickup_empty_state)}`);
    }

    lines.push(``);
    lines.push(`DELIVER:`);
    lines.push(`  ${fmtLocation(d.delivery_city, d.delivery_state)}`);
    lines.push(`  ${fmtDate(d.delivery_date)} at ${d.delivery_time || "?"}`);

    if (d.delivery_type === "lot_return" && (d.lot_return_city || d.lot_return_state)) {
      lines.push(`  ⚠️ Return trailer to: ${fmtLocation(d.lot_return_city, d.lot_return_state)}`);
    }

    lines.push(``);
    lines.push(`WHAT YOU'RE HAULING:`);
    lines.push(`  ${d.commodity || "?"} — ${d.weight_lbs || "?"} lbs`);

    if (d.miles) {
      lines.push(`  Distance: ${d.miles} miles`);
    }

    if (d.target_rate) {
      // Format with commas for readability: 2800 -> "2,800"
      const rateFmt = Number(d.target_rate).toLocaleString("en-US");
      lines.push(``);
      lines.push(`💰 RATE: $${rateFmt}`);
    }

    if (d.notes && d.notes.trim()) {
      lines.push(``);
      lines.push(`NOTES:`);
      lines.push(`  ${d.notes.trim()}`);
    }
    return lines.join("\n");
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
