const SCRIPT_BASE = "PASTE_YOUR_SCRIPT_URL_HERE"; // .../exec

const slotSel = document.getElementById("slot_id");
const msgEl = document.getElementById("msg");
const participantsEl = document.getElementById("participants");
const countEl = document.getElementById("count");

// Statische Termine 2026
const TERMINE = [
  "25.02.2026",
  "07.03.2026",
  "14.03.2026",
  "21.03.2026",
  "28.03.2026",
  "04.04.2026",
  "18.04.2026",
  "25.04.2026",
  "01.05.2026",
  "02.05.2026",
  "16.05.2026",
  "30.05.2026",
  "13.06.2026",
  "20.06.2026",
  "27.06.2026",
  "04.07.2026",
  "18.07.2026",
  "01.08.2026",
  "08.08.2026",
  "15.08.2026",
  "22.08.2026",
  "29.08.2026",
  "05.09.2026",
  "19.09.2026",
  "03.10.2026",
  "17.10.2026"
];

// Wochentag-Namen
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function parseDate(dateStr) {
  // "25.02.2026" -> Date
  const [day, month, year] = dateStr.split(".");
  return new Date(year, month - 1, day);
}

function formatSlotId(dateStr) {
  // "25.02.2026" -> "2026-02-25"
  const [day, month, year] = dateStr.split(".");
  return `${year}-${month}-${day}`;
}

function renderTermine() {
  slotSel.innerHTML = "";
  
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  
  TERMINE.forEach(termin => {
    const date = parseDate(termin);
    
    // Nur zukünftige Termine anzeigen
    if (date >= heute) {
      const wochentag = WOCHENTAGE[date.getDay()];
      const opt = document.createElement("option");
      opt.value = formatSlotId(termin);
      opt.textContent = `${wochentag}, ${termin} • 09:00–15:00 Uhr`;
      slotSel.appendChild(opt);
    }
  });
  
  // Falls keine Termine verfügbar
  if (slotSel.options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aktuell keine Termine verfügbar";
    opt.disabled = true;
    slotSel.appendChild(opt);
  }
}

function renderParticipants(n) {
  participantsEl.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement("div");
    wrap.className = "pbox";
    wrap.innerHTML = `
      <h4>Teilnehmer ${i+1}</h4>
      <div class="grid">
        <label>Vorname <input data-k="first_name" required></label>
        <label>Nachname <input data-k="last_name" required></label>
        <label>Handynummer <input data-k="phone" type="tel" required></label>
        <label>E-Mail <input data-k="email" type="email"></label>
        <label>Straße <input data-k="street" required></label>
        <label>Hausnr <input data-k="house_no" required></label>
        <label>PLZ <input data-k="zip" required></label>
        <label>Ort <input data-k="city" required></label>
      </div>
    `;
    participantsEl.appendChild(wrap);
  }
}

countEl.addEventListener("input", () => {
  const n = Math.max(1, Math.min(8, Number(countEl.value || 1)));
  countEl.value = n;
  renderParticipants(n);
});

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  msgEl.textContent = "Sende Buchung…";

  const n = Number(countEl.value);
  const pBoxes = [...participantsEl.querySelectorAll(".pbox")];

  const participants = pBoxes.map(box => {
    const get = (k) => box.querySelector(`[data-k="${k}"]`).value.trim();
    return {
      first_name: get("first_name"),
      last_name: get("last_name"),
      phone: get("phone"),
      email: get("email"),
      street: get("street"),
      house_no: get("house_no"),
      zip: get("zip"),
      city: get("city")
    };
  });

  const payload = {
    slot_id: slotSel.value,
    contact_email: document.getElementById("contact_email").value.trim(),
    contact_phone: document.getElementById("contact_phone").value.trim(),
    participants,
    agbAccepted: document.getElementById("agb").checked,
    privacyAccepted: document.getElementById("privacy").checked
  };

  try {
    const res = await fetch(`${SCRIPT_BASE}?action=book`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (data.ok) {
      // Weiterleitung zur Bestätigungsseite
      const params = new URLSearchParams({
        booking_id: data.booking_id,
        date: slotSel.options[slotSel.selectedIndex].textContent,
        email: payload.contact_email,
        count: n
      });
      window.location.href = `success.html?${params.toString()}`;
    } else {
      msgEl.textContent = `❌ ${data.message || "Fehler bei der Buchung"}`;
    }
  } catch (error) {
    msgEl.textContent = "❌ Verbindungsfehler. Bitte versuchen Sie es erneut.";
  }
});

// Initialisierung
renderParticipants(1);
renderTermine();
