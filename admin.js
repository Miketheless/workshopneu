/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Admin JavaScript
 * Golfclub Metzenhof – Version 2.0 (16.01.2026)
 * ═══════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════

// WICHTIG: Hier die URL des Google Apps Script Web App eintragen!
const API_BASE = "https://script.google.com/macros/s/AKfycbzeT3syS3BN25_HR9QJ-qzHETYSTyz_Z61KxvIa8K0nr5b8XzIGr6A-FwyERn_DU3Dl_A/exec";

// ══════════════════════════════════════════════════════════════
// DOM ELEMENTE
// ══════════════════════════════════════════════════════════════

const elements = {
  loginSection: document.getElementById("login-section"),
  adminPanel: document.getElementById("admin-panel"),
  adminKey: document.getElementById("admin-key"),
  loginBtn: document.getElementById("login-btn"),
  loginMessage: document.getElementById("login-message"),
  refreshBtn: document.getElementById("refresh-btn"),
  exportBtn: document.getElementById("export-btn"),
  statTotal: document.getElementById("stat-total"),
  statConfirmed: document.getElementById("stat-confirmed"),
  statCancelled: document.getElementById("stat-cancelled"),
  statParticipants: document.getElementById("stat-participants"),
  bookingsContainer: document.getElementById("bookings-container")
};

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

let currentAdminKey = "";
let bookingsData = [];

// ══════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Datum formatieren: "2026-02-25" → "25.02.2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return "–";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Timestamp formatieren
 */
function formatTimestamp(ts) {
  if (!ts) return "–";
  const date = new Date(ts);
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Nachricht anzeigen
 */
function showLoginMessage(text, type = "") {
  elements.loginMessage.textContent = text;
  elements.loginMessage.className = `message ${type}`;
}

// ══════════════════════════════════════════════════════════════
// API FUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Buchungen vom Backend laden
 */
async function fetchBookings(adminKey) {
  const response = await fetch(`${API_BASE}?action=admin_bookings&admin_key=${encodeURIComponent(adminKey)}`);
  return await response.json();
}

/**
 * CSV Export URL generieren
 */
function getExportUrl(adminKey) {
  return `${API_BASE}?action=admin_export_csv&admin_key=${encodeURIComponent(adminKey)}`;
}

// ══════════════════════════════════════════════════════════════
// RENDER FUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Statistiken berechnen und anzeigen
 */
function renderStats() {
  const total = bookingsData.length;
  const confirmed = bookingsData.filter(b => b.status === "CONFIRMED").length;
  const cancelled = bookingsData.filter(b => b.status === "CANCELLED").length;
  const participants = bookingsData
    .filter(b => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + (b.participants_count || 0), 0);
  
  elements.statTotal.textContent = total;
  elements.statConfirmed.textContent = confirmed;
  elements.statCancelled.textContent = cancelled;
  elements.statParticipants.textContent = participants;
}

/**
 * Buchungstabelle rendern
 */
function renderBookings() {
  if (bookingsData.length === 0) {
    elements.bookingsContainer.innerHTML = '<p class="text-muted">Keine Buchungen vorhanden.</p>';
    return;
  }
  
  // Nach Datum sortieren (neueste zuerst)
  const sorted = [...bookingsData].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  const tableHtml = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Buchungs-ID</th>
          <th>Datum</th>
          <th>Termin</th>
          <th>Kontakt</th>
          <th>Teilnehmer</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(booking => `
          <tr>
            <td><strong>${booking.booking_id || "–"}</strong></td>
            <td>${formatTimestamp(booking.timestamp)}</td>
            <td>${formatDate(booking.slot_id)}</td>
            <td>
              ${booking.contact_email || "–"}<br>
              <small class="text-muted">${booking.contact_phone || "–"}</small>
            </td>
            <td>
              ${booking.participants_count || 0}
              ${booking.participants && booking.participants.length > 0 ? `
                <div class="participants-list">
                  ${booking.participants.map(p => 
                    `${p.first_name} ${p.last_name}`
                  ).join("<br>")}
                </div>
              ` : ""}
            </td>
            <td>
              <span class="status-badge ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}">
                ${booking.status === "CONFIRMED" ? "Bestätigt" : "Storniert"}
              </span>
              ${booking.cancelled_at ? `<br><small class="text-muted">${formatTimestamp(booking.cancelled_at)}</small>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  
  elements.bookingsContainer.innerHTML = tableHtml;
}

// ══════════════════════════════════════════════════════════════
// EVENT HANDLER
// ══════════════════════════════════════════════════════════════

/**
 * Login
 */
async function handleLogin() {
  const key = elements.adminKey.value.trim();
  if (!key) {
    showLoginMessage("Bitte geben Sie den Admin-Schlüssel ein.", "error");
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = "Wird geprüft...";
  showLoginMessage("Anmeldung wird geprüft...", "loading");
  
  try {
    const result = await fetchBookings(key);
    
    if (result.ok) {
      currentAdminKey = key;
      bookingsData = result.bookings || [];
      
      // UI wechseln
      elements.loginSection.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      
      // Daten anzeigen
      renderStats();
      renderBookings();
    } else {
      showLoginMessage(result.message || "Ungültiger Admin-Schlüssel.", "error");
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Anmelden";
    }
  } catch (error) {
    console.error("Login-Fehler:", error);
    showLoginMessage("Verbindungsfehler. Bitte versuchen Sie es später.", "error");
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = "Anmelden";
  }
}

/**
 * Daten aktualisieren
 */
async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = "Lädt...";
  
  try {
    const result = await fetchBookings(currentAdminKey);
    
    if (result.ok) {
      bookingsData = result.bookings || [];
      renderStats();
      renderBookings();
    }
  } catch (error) {
    console.error("Refresh-Fehler:", error);
  }
  
  elements.refreshBtn.disabled = false;
  elements.refreshBtn.textContent = "Daten aktualisieren";
}

/**
 * CSV Export
 */
function handleExport() {
  const url = getExportUrl(currentAdminKey);
  window.open(url, "_blank");
}

// Event Listener
elements.loginBtn.addEventListener("click", handleLogin);
elements.adminKey.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLogin();
});
elements.refreshBtn.addEventListener("click", handleRefresh);
elements.exportBtn.addEventListener("click", handleExport);

