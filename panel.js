// ilvolAI panel logic
// Form behavior + mic (Web Speech API) + paste (clipboard) + backend call
// + per-field confidence chips.

(function () {
  const root = document.getElementById("ilvolai-panel");
  const form = document.getElementById("ilvolai-form");
  const status = document.getElementById("ilvolai-status");
  const micPanel = root.querySelector(".ilvolai-mic-panel");
  const micDot = root.querySelector(".ilvolai-mic-dot");
  const micLabel = root.querySelector(".ilvolai-mic-label");
  const transcriptEl = root.querySelector(".ilvolai-transcript");
  const applyBar = root.querySelector(".ilvolai-apply-bar");

  // Backend URL — match background.js. Set per environment.
  const BACKEND_URL = "https://ilvolai-backend.REPLACE_ME.workers.dev";

  // ---- Form helpers (existing behavior) ----

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

  function getLoadData() {
    const fd = new FormData(form);
    const data = {};
    for (const [key, value] of fd.entries()) {
      data[key] = typeof value === "string" ? value.trim() : value;
    }
    if (data.weight_lbs) data.weight_lbs = Number(data.weight_lbs);
    if (data.target_rate) data.target_rate = Number(data.target_rate);
    return data;
  }

  // Apply AI-extracted fields + clear stale confidence chips first.
  function setLoadData(data = {}) {
    // Clear any existing confidence chips from the previous extraction.
    clearConfidence();
    Object.entries(data).forEach(([key, value]) => {
      const el = form.elements.namedItem(key);
      if (!el) return;
      if (typeof value === "number") el.value = value;
      else if (value == null) el.value = "";
      else el.value = value;
    });
    form.querySelectorAll("select[data-conditional]").forEach((t) =>
      t.dispatchEvent(new Event("change"))
    );
    // Enable the copy button — we have content to copy.
    root.querySelector(".ilvolai-btn-copy").disabled = false;
  }

  // ---- Confidence chip rendering ----
  //
  // Each form label has a <em class="ilvolai-confidence" data-for="...">
  // that we fill with a small badge like "92%". Below 80% we add a
  // warning class so the dispatcher knows to double-check.

  function paintConfidence(map) {
    if (!map) return;
    Object.entries(map).forEach(([field, pct]) => {
      const chip = root.querySelector(
        `.ilvolai-confidence[data-for="${field}"]`
      );
      if (!chip) return;
      const value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      chip.textContent = value > 0 ? `${value}%` : "";
      chip.classList.toggle("ilvolai-confidence--low", value > 0 && value < 80);
      chip.classList.toggle("ilvolai-confidence--hi", value >= 80);
    });
  }

  function clearConfidence() {
    root.querySelectorAll(".ilvolai-confidence").forEach((el) => {
      el.textContent = "";
      el.classList.remove("ilvolai-confidence--low", "ilvolai-confidence--hi");
    });
  }

  // ---- Status messages ----

  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg || "";
    status.className = "ilvolai-status" + (kind ? ` ilvolai-status--${kind}` : "");
  }

  // ---- Backend call ----

  async function callExtract(transcript) {
    const auth = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
        resolve(resp?.auth || null);
      });
    });
    if (!auth?.jwt) {
      throw new Error("Not signed in. Open the popup and sign in with Google.");
    }
    const r = await fetch(`${BACKEND_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.jwt}`,
      },
      body: JSON.stringify({ transcript }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      if (r.status === 429) {
        throw new Error(
          `Daily quota reached (${err.limit}/day). Resets in ${Math.ceil((err.resetsInSeconds || 0) / 3600)}h.`
        );
      }
      throw new Error(err.error || `Backend error ${r.status}`);
    }
    return r.json();
  }

  // ---- Apply: send transcript to backend, fill form, paint chips ----

  async function applyTranscript() {
    const text = (transcriptEl.textContent || "").trim();
    if (!text) {
      setStatus("Nothing to apply. Record audio or paste text first.", "warn");
      return;
    }
    const btn = root.querySelector(".ilvolai-btn-apply");
    btn.disabled = true;
    btn.textContent = "✨ Extracting…";
    setStatus("Asking the AI to extract fields…");
    try {
      const { fields, confidence, stats } = await callExtract(text);
      setLoadData(fields);
      paintConfidence(confidence);
      const filled = stats?.fieldsFilled ?? Object.keys(fields).length;
      setStatus(`Filled ${filled} fields from your transcript.`, "ok");
    } catch (e) {
      setStatus(e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ Apply to form";
    }
  }

  // ---- Paste from clipboard ----

  async function onPaste() {
    setStatus("");
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      setStatus("Couldn't read clipboard. Copy the text first, then try again.", "err");
      return;
    }
    if (!text || !text.trim()) {
      setStatus("Clipboard is empty.", "warn");
      return;
    }
    transcriptEl.textContent = text.trim();
    showApplyBar();
    setStatus(`Read ${text.length} chars from clipboard. Review then tap Apply.`, "ok");
  }

  // ---- Mic (Web Speech API) ----

  let recognition = null;
  let finalTranscript = "";
  let interimTranscript = "";

  function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("This browser doesn't support voice input. Use Chrome, or paste text instead.", "err");
      return;
    }
    finalTranscript = "";
    interimTranscript = "";
    transcriptEl.textContent = "";
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      transcriptEl.textContent = (finalTranscript + interimTranscript).trim();
    };

    recognition.onerror = (event) => {
      // 'no-speech' is normal (silence); don't shout at the user.
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus("Microphone access blocked. Allow it in Chrome's site settings.", "err");
        stopMic();
        return;
      }
      setStatus(`Mic error: ${event.error}`, "err");
    };

    recognition.onend = () => {
      // If we never explicitly stopped, the mic may have ended on its own
      // (e.g. on a long silence). If we have a transcript, show the apply
      // bar so the user can still extract.
      hideMicPanel();
      const t = (finalTranscript + interimTranscript).trim();
      if (t) {
        transcriptEl.textContent = t;
        showApplyBar();
        setStatus("Recording stopped. Review the transcript then tap Apply.", "ok");
      }
    };

    try {
      recognition.start();
      showMicPanel();
      setStatus("Listening. Tap ⏹ when you're done.", "ok");
    } catch (e) {
      setStatus("Couldn't start microphone: " + e.message, "err");
    }
  }

  function stopMic() {
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    hideMicPanel();
    const t = transcriptEl.textContent.trim();
    if (t) {
      showApplyBar();
      setStatus("Recording stopped. Review then tap Apply.", "ok");
    }
  }

  function clearTranscript() {
    finalTranscript = "";
    interimTranscript = "";
    transcriptEl.textContent = "";
    hideApplyBar();
    setStatus("");
  }

  function showMicPanel() {
    micPanel.hidden = false;
    micLabel.textContent = "Listening…";
    micDot.classList.add("ilvolai-mic-dot--active");
    root.querySelector(".ilvolai-btn-mic").textContent = "⏹ Stop listening";
    applyBar.hidden = true;
  }

  function hideMicPanel() {
    micPanel.hidden = true;
    micDot.classList.remove("ilvolai-mic-dot--active");
    root.querySelector(".ilvolai-btn-mic").textContent = "🎤 Start listening";
  }

  function showApplyBar() {
    applyBar.hidden = false;
  }

  function hideApplyBar() {
    applyBar.hidden = true;
  }

  // ---- Driver message formatting (existing) ----

  function onCopy() {
    const data = getLoadData();
    const text = formatDriverMessage(data);
    navigator.clipboard.writeText(text).then(() => {
      flashButton("📤 Copied!");
    });
  }

  function fmtDate(dateStr) {
    if (!dateStr) return "?";
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

  const PICKUP_TYPE_LABEL = {
    preloaded: "Preloaded — just hook & go (no waiting)",
    live:      "Live load — wait while they load you",
  };
  const DELIVERY_TYPE_LABEL = {
    live_unload:  "Live unload — wait while they unload you",
    drop_bobtail: "Drop & bobtail — leave trailer, return empty",
    drop_hook:    "Drop & hook — swap trailers",
    lot_return:   "Lot return to shipper",
  };

  function formatDriverMessage(d) {
    const lines = [];
    lines.push(`🚛 LOAD DETAILS`);
    lines.push(``);
    lines.push(`PICK UP:`);
    lines.push(`  ${fmtLocation(d.pickup_city, d.pickup_state)}`);
    lines.push(`  ${fmtDate(d.pickup_date)} at ${d.pickup_time || "?"}`);
    if (PICKUP_TYPE_LABEL[d.pickup_type]) {
      lines.push(`  📦 ${PICKUP_TYPE_LABEL[d.pickup_type]}`);
    }
    if (d.pickup_empty === "yes" && (d.pickup_empty_city || d.pickup_empty_state)) {
      lines.push(`  ⚠️ Empty from: ${fmtLocation(d.pickup_empty_city, d.pickup_empty_state)}`);
    }
    lines.push(``);
    lines.push(`DELIVER:`);
    lines.push(`  ${fmtLocation(d.delivery_city, d.delivery_state)}`);
    lines.push(`  ${fmtDate(d.delivery_date)} at ${d.delivery_time || "?"}`);
    if (DELIVERY_TYPE_LABEL[d.delivery_type]) {
      lines.push(`  📦 ${DELIVERY_TYPE_LABEL[d.delivery_type]}`);
    }
    if (d.delivery_type === "lot_return" && (d.lot_return_city || d.lot_return_state)) {
      lines.push(`  ⚠️ Return trailer to: ${fmtLocation(d.lot_return_city, d.lot_return_state)}`);
    }
    lines.push(``);
    lines.push(`WHAT YOU'RE HAULING:`);
    lines.push(`  ${d.commodity || "?"} — ${d.weight_lbs || "?"} lbs`);
    if (d.miles) lines.push(`  Distance: ${d.miles} miles`);
    if (d.target_rate) {
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
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
  });

  // Mic button toggles between start/stop listening.
  root.querySelector(".ilvolai-btn-mic").addEventListener("click", () => {
    if (recognition) stopMic();
    else startMic();
  });

  root.querySelector(".ilvolai-btn-paste").addEventListener("click", onPaste);
  root.querySelector(".ilvolai-btn-stop").addEventListener("click", stopMic);
  root.querySelector(".ilvolai-btn-clear").addEventListener("click", clearTranscript);
  root.querySelector(".ilvolai-btn-apply").addEventListener("click", applyTranscript);
  root.querySelector(".ilvolai-btn-edit").addEventListener("click", () => {
    // Make the transcript area editable so the user can correct typos
    // before hitting Apply.
    transcriptEl.contentEditable = "true";
    transcriptEl.focus();
    setStatus("Edit the transcript inline, then tap Apply again.", "ok");
  });
  root.querySelector(".ilvolai-btn-copy").addEventListener("click", onCopy);

  // Clear confidence chips when the user manually edits any field —
  // those old percentages are no longer accurate.
  form.addEventListener("input", () => {
    root.querySelector(".ilvolai-btn-copy").disabled = false;
    clearConfidence();
  });

  wireConditionals();
})();
