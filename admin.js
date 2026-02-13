/**
 * ═══════════════════════════════════════════════════════════
 * WORKSHOP ADMIN – Gemma Golfn v1.1
 * Buchungsliste, Terminverwaltung, CSV-Export
 * ═══════════════════════════════════════════════════════════
 */

const SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbzzN5zS2802FgcA0k3pGaLJ4a-xTiYte3uEYy846IScsKT5CqDpzdUTXKvptxlKeoQW/exec";

let currentAdminKey = "";
let bookingsData = [];
let slotsData = [];
let workshopsData = [];

function $(id) { return document.getElementById(id); }

function showLoading(show) {
  const el = $("loading-overlay");
  if (el) el.classList.toggle("hidden", !show);
}

function formatDate(str) {
  if (!str) return "–";
  const s = String(str);
  if (s.includes("T")) return s.split("T")[0];
  if (s.includes("-")) {
    const [y, m, d] = s.split("-");
    return d + "." + m + "." + y;
  }
  return str;
}

function formatTimestamp(ts) {
  if (!ts) return "–";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isPast(dateStr) {
  if (!dateStr) return false;
  const d = new Date(String(dateStr).split("T")[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

async function fetchBookings(adminKey) {
  const res = await fetch(SCRIPT_BASE + "?action=admin_bookings&admin_key=" + encodeURIComponent(adminKey));
  return res.json();
}

async function fetchSlots(adminKey) {
  const res = await fetch(SCRIPT_BASE + "?action=admin_slots&admin_key=" + encodeURIComponent(adminKey));
  return res.json();
}

async function addSlot(adminKey, workshopId, date, start, end) {
  const params = new URLSearchParams({
    action: "admin_add_slot",
    admin_key: adminKey,
    workshop_id: workshopId,
    date: date,
    start: start || "10:00",
    end: end || "12:00"
  });
  const res = await fetch(SCRIPT_BASE + "?" + params.toString());
  return res.json();
}

async function handleLogin() {
  const key = $("admin-key").value.trim();
  if (!key) {
    $("login-message").textContent = "Bitte Schlüssel eingeben";
    return;
  }
  
  $("login-btn").disabled = true;
  $("login-btn").textContent = "Prüfe...";
  
  try {
    const [bookingsRes, slotsRes] = await Promise.all([
      fetchBookings(key),
      fetchSlots(key)
    ]);
    
    if (bookingsRes.ok && slotsRes.ok) {
      currentAdminKey = key;
      bookingsData = bookingsRes.bookings || [];
      slotsData = slotsRes.slots || [];
      workshopsData = slotsRes.workshops || [];
      
      const workshopIds = [...new Set(bookingsData.map(b => b.workshop_id).filter(Boolean))];
      const workshopsFromBookings = workshopIds.map(id => ({
        workshop_id: id,
        title: bookingsData.find(b => b.workshop_id === id)?.workshop_title || id
      }));
      
      workshopsData = workshopsData.length ? workshopsData : workshopsFromBookings;
      
      $("login-section").classList.add("hidden");
      $("admin-panel").classList.remove("hidden");
      
      initTabs();
      renderFilter();
      renderBookings();
      renderSlotsForm();
      renderSlotsTable();
      renderSlotsFilter();
    } else {
      $("login-message").textContent = bookingsRes.message || slotsRes.message || "Ungültiger Schlüssel";
      $("login-btn").disabled = false;
      $("login-btn").textContent = "Anmelden";
    }
  } catch (e) {
    $("login-message").textContent = "Verbindungsfehler";
    $("login-btn").disabled = false;
    $("login-btn").textContent = "Anmelden";
  }
}

function initTabs() {
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab)?.classList.add("active");
    });
  });
}

function renderFilter() {
  const sel = $("filter-workshop");
  sel.innerHTML = '<option value="">– Alle –</option>';
  const seen = new Set();
  bookingsData.forEach(b => {
    if (b.workshop_id && !seen.has(b.workshop_id)) {
      seen.add(b.workshop_id);
      const opt = document.createElement("option");
      opt.value = b.workshop_id;
      opt.textContent = b.workshop_title || b.workshop_id;
      sel.appendChild(opt);
    }
  });
  workshopsData.forEach(w => {
    if (w.workshop_id && !seen.has(w.workshop_id)) {
      seen.add(w.workshop_id);
      const opt = document.createElement("option");
      opt.value = w.workshop_id;
      opt.textContent = w.title || w.workshop_id;
      sel.appendChild(opt);
    }
  });
  sel.removeEventListener("change", renderBookings);
  sel.addEventListener("change", renderBookings);
}

function renderBookings() {
  const filterWorkshop = $("filter-workshop").value;
  let filtered = bookingsData;
  if (filterWorkshop) {
    filtered = bookingsData.filter(b => b.workshop_id === filterWorkshop);
  }
  
  const container = $("bookings-container");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Buchungen vorhanden.</p>';
    return;
  }
  
  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Buchungs-ID</th>
          <th>Datum</th>
          <th>Slot</th>
          <th>Workshop</th>
          <th>E-Mail</th>
          <th>TN</th>
          <th>Status</th>
          <th>Teilnehmer</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach(b => {
    const cancelled = b.status === "CANCELLED";
    const participantsStr = (b.participants || [])
      .map(p => (p.first_name || "") + " " + (p.last_name || "") + " (" + (p.email || "") + ")")
      .join("; ");
    
    html += `
      <tr class="${cancelled ? "row-cancelled" : ""}">
        <td><strong>${b.booking_id}</strong></td>
        <td>${formatTimestamp(b.timestamp)}</td>
        <td>${b.slot_id || "–"}</td>
        <td>${b.workshop_title || b.workshop_id || "–"}</td>
        <td><a href="mailto:${b.contact_email}">${b.contact_email || "–"}</a></td>
        <td>${b.participants_count || 0}</td>
        <td><span class="status-badge ${cancelled ? "cancelled" : "confirmed"}">${cancelled ? "Storno" : "OK"}</span></td>
        <td style="font-size:0.8rem; max-width:200px; overflow:hidden; text-overflow:ellipsis;" title="${participantsStr}">${participantsStr || "–"}</td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  html += "<p style='font-size:0.75rem; color:#666; margin-top:0.5rem;'>Buchungen: " + filtered.length + "</p>";
  
  container.innerHTML = html;
}

function renderSlotsForm() {
  const sel = $("add-workshop");
  sel.innerHTML = '<option value="">– Workshop wählen –</option>';
  workshopsData.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.workshop_id;
    opt.textContent = w.title || w.workshop_id;
    sel.appendChild(opt);
  });
}

function renderSlotsFilter() {
  const sel = $("filter-slots-workshop");
  sel.innerHTML = '<option value="">– Alle –</option>';
  const seen = new Set();
  workshopsData.forEach(w => {
    if (w.workshop_id && !seen.has(w.workshop_id)) {
      seen.add(w.workshop_id);
      const opt = document.createElement("option");
      opt.value = w.workshop_id;
      opt.textContent = w.title || w.workshop_id;
      sel.appendChild(opt);
    }
  });
  sel.removeEventListener("change", renderSlotsTable);
  sel.addEventListener("change", renderSlotsTable);
}

function renderSlotsTable() {
  const filterWorkshop = $("filter-slots-workshop")?.value || "";
  let filtered = slotsData;
  if (filterWorkshop) {
    filtered = slotsData.filter(s => s.workshop_id === filterWorkshop);
  }
  
  filtered.sort((a, b) => {
    const d1 = (a.date || "").toString();
    const d2 = (b.date || "").toString();
    if (d1 !== d2) return d1.localeCompare(d2);
    return (a.start || "").localeCompare(b.start || "");
  });
  
  const container = $("slots-container");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Termine vorhanden.</p>';
    return;
  }
  
  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Workshop</th>
          <th>Datum</th>
          <th>Zeit</th>
          <th>Gebucht</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach(s => {
    const past = isPast(s.date);
    const statusClass = s.status === "FULL" ? "full" : "open";
    
    html += `
      <tr class="${past ? "row-past" : ""}">
        <td>${s.workshop_title || s.workshop_id || "–"}</td>
        <td>${formatDate(s.date)}</td>
        <td>${s.start || "–"}–${s.end || "–"}</td>
        <td>${s.booked || 0} / ${s.capacity || 4}</td>
        <td><span class="status-badge ${statusClass}">${s.status === "FULL" ? "Voll" : "Offen"}</span></td>
      </tr>
    `;
  });
  
  html += "</tbody></table>";
  html += "<p style='font-size:0.75rem; color:#666; margin-top:0.5rem;'>Termine: " + filtered.length + "</p>";
  
  container.innerHTML = html;
}

async function handleAddSlot(e) {
  e.preventDefault();
  
  const workshopId = $("add-workshop").value;
  const dateInput = $("add-date").value;
  const start = ($("add-start").value || "10:00").trim();
  const end = ($("add-end").value || "12:00").trim();
  
  if (!workshopId || !dateInput) {
    $("add-slot-message").textContent = "Workshop und Datum erforderlich.";
    $("add-slot-message").className = "message error";
    $("add-slot-message").style.display = "block";
    return;
  }
  
  $("add-slot-message").textContent = "Wird angelegt...";
  $("add-slot-message").className = "message";
  $("add-slot-message").style.display = "block";
  
  const result = await addSlot(currentAdminKey, workshopId, dateInput, start, end);
  
  if (result.ok) {
    $("add-slot-message").textContent = "✓ Termin erfolgreich angelegt.";
    $("add-slot-message").className = "message success";
    $("add-date").value = "";
    await handleRefresh();
  } else {
    $("add-slot-message").textContent = "Fehler: " + (result.message || "Unbekannt");
    $("add-slot-message").className = "message error";
  }
}

async function handleRefresh() {
  showLoading(true);
  $("refresh-btn").disabled = true;
  $("refresh-btn").textContent = "⏳...";
  
  try {
    const [bookingsRes, slotsRes] = await Promise.all([
      fetchBookings(currentAdminKey),
      fetchSlots(currentAdminKey)
    ]);
    
    if (bookingsRes.ok) {
      bookingsData = bookingsRes.bookings || [];
    }
    if (slotsRes.ok) {
      slotsData = slotsRes.slots || [];
      workshopsData = slotsRes.workshops || [];
    }
    
    renderFilter();
    renderBookings();
    renderSlotsForm();
    renderSlotsTable();
    renderSlotsFilter();
  } catch (e) {
    console.error(e);
  }
  
  showLoading(false);
  $("refresh-btn").disabled = false;
  $("refresh-btn").textContent = "🔄 Aktualisieren";
}

async function handleExport() {
  try {
    $("export-btn").disabled = true;
    $("export-btn").textContent = "Exportiere...";
    
    const res = await fetch(SCRIPT_BASE + "?action=admin_export_csv&admin_key=" + encodeURIComponent(currentAdminKey));
    const text = await res.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      alert("Export fehlgeschlagen: Ungültige Antwort");
      return;
    }
    
    if (data.success && data.csv) {
      const blob = new Blob(["\uFEFF" + data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workshop_buchungen_" + new Date().toISOString().split("T")[0] + ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert("Export fehlgeschlagen");
    }
  } catch (err) {
    alert("Export-Fehler: " + err.message);
  } finally {
    $("export-btn").disabled = false;
    $("export-btn").textContent = "📥 CSV Export";
  }
}

$("login-btn").addEventListener("click", handleLogin);
$("admin-key").addEventListener("keypress", e => { if (e.key === "Enter") handleLogin(); });
$("refresh-btn").addEventListener("click", handleRefresh);
$("export-btn").addEventListener("click", handleExport);
$("add-slot-form").addEventListener("submit", handleAddSlot);
