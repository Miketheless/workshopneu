const SCRIPT_BASE = "PASTE_YOUR_SCRIPT_URL_HERE";
const keyInput = document.getElementById("admin_key");
const msgEl = document.getElementById("msg");
const listEl = document.getElementById("list");

keyInput.value = sessionStorage.getItem("admin_key") || "";

document.getElementById("load").addEventListener("click", load);
document.getElementById("export").addEventListener("click", exportCsv);

async function load() {
  const k = keyInput.value.trim();
  sessionStorage.setItem("admin_key", k);
  msgEl.textContent = "Lade…";

  const res = await fetch(`${SCRIPT_BASE}?action=admin_bookings&admin_key=${encodeURIComponent(k)}`);
  const data = await res.json();

  if (!data.ok) {
    msgEl.textContent = "❌ Kein Zugriff (Key falsch?)";
    listEl.innerHTML = "";
    return;
  }

  msgEl.textContent = `✅ ${data.bookings.length} Buchungen`;
  render(data.bookings);
}

function render(bookings) {
  listEl.innerHTML = "";
  bookings.forEach(b => {
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `
      <div><b>${b.status}</b> • ${b.timestamp || ""}</div>
      <div>Booking: <code>${b.booking_id}</code></div>
      <div>Slot: <code>${b.slot_id}</code></div>
      <div>Kontakt: ${b.contact_email} • Teilnehmer: ${b.participants_count}</div>
      <details>
        <summary>Teilnehmer anzeigen</summary>
        <ol>
          ${(b.participants || []).map(p =>
            `<li>${p.first_name} ${p.last_name}, ${p.street} ${p.house_no}, ${p.zip} ${p.city}</li>`
          ).join("")}
        </ol>
      </details>
    `;
    listEl.appendChild(div);
  });
}

function exportCsv() {
  const k = (keyInput.value || "").trim();
  sessionStorage.setItem("admin_key", k);
  window.open(`${SCRIPT_BASE}?action=admin_export_csv&admin_key=${encodeURIComponent(k)}`, "_blank");
}
