/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLATZREIFE – Google Apps Script Backend
 * Golfclub Metzenhof
 * 
 * INSTALLATION:
 * 1. Google Sheets erstellen mit 4 Tabs: Slots, Bookings, Participants, Settings
 * 2. script.google.com → Neues Projekt
 * 3. Diesen Code einfügen
 * 4. SPREADSHEET_ID unten eintragen
 * 5. Bereitstellen → Als Web-App bereitstellen
 *    - Ausführen als: Ich
 *    - Zugriff: Jeder
 * 6. URL kopieren und in app.js / admin.js / cancel.html eintragen
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

// WICHTIG: Google Sheets ID hier eintragen!
const SPREADSHEET_ID = "1NkaviS-fPq_A04HntatthchUYgjTto04Adicd-LvmBg"

// Sheet-Namen
const SHEET_SLOTS = "Slots";
const SHEET_BOOKINGS = "Bookings";
const SHEET_PARTICIPANTS = "Participants";
const SHEET_SETTINGS = "Settings";

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Spreadsheet öffnen
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Sheet nach Name holen
 */
function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/**
 * Einstellung aus Settings-Sheet lesen
 */
function getSetting(key) {
  const sheet = getSheet(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return null;
}

/**
 * Eindeutige Buchungs-ID generieren
 */
function generateBookingId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "PL-";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Cancel-Token generieren
 */
function generateCancelToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * JSON-Response senden
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GLOBALE HILFSFUNKTION: Datum-Teil aus verschiedenen Formaten extrahieren
 * Gibt immer YYYY-MM-DD zurück (lokale Zeitzone für Date-Objekte)
 */
function extractSlotDateId(value) {
  if (!value) return "";
  
  // Wenn es ein Date-Objekt ist (aus Google Sheets)
  if (value instanceof Date) {
    // Lokale Zeitzone verwenden (wie in Google Sheets angezeigt)
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // Wenn es ein String ist
  const str = String(value).trim();
  
  // ISO-Format mit T: 2026-02-24T23:00:00.000Z
  // Hier nur den Teil vor T nehmen
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  
  // Bereits im Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Fallback
  return str;
}

/**
 * Datum formatieren für E-Mail
 */
function formatDateForEmail(dateValue) {
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  
  let date;
  
  // Wenn es bereits ein Date-Objekt ist
  if (dateValue instanceof Date) {
    date = dateValue;
  } 
  // Wenn es ein String ist
  else if (typeof dateValue === "string") {
    // ISO-Format mit T: 2026-02-24T23:00:00.000Z
    if (dateValue.includes('T')) {
      date = new Date(dateValue);
    } 
    // Einfaches Format: 2026-02-25
    else if (dateValue.includes('-')) {
      const [year, month, day] = dateValue.split("-");
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    else {
      date = new Date(dateValue);
    }
  }
  else {
    // Fallback
    date = new Date(dateValue);
  }
  
  const weekday = weekdays[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${weekday}, ${day}.${month}.${year}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPUNKTE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * HTTP GET Handler
 * Unterstützt auch Buchungen via GET (für CORS-Kompatibilität)
 */
function doGet(e) {
  // Sicherheitsprüfung für fehlende Parameter
  if (!e || !e.parameter) {
    return jsonResponse({ ok: false, message: "Keine Parameter übergeben" });
  }
  
  const action = e.parameter.action;
  
  switch (action) {
    case "slots":
      return handleGetSlots();
      
    case "book":
      // Buchung via GET mit Base64-kodierten Daten (CORS-sicher)
      return handleBookViaGet(e.parameter.data);
      
    case "cancel":
      return handleCancel(e.parameter.token);
      
    case "admin_bookings":
      return handleAdminBookings(e.parameter.admin_key);
      
    case "admin_export_csv":
      return handleAdminExportCsv(e.parameter.admin_key);
      
    case "admin_update":
      // Admin-Update: Checkboxen und Bezahldatum ändern
      return handleAdminUpdate(e.parameter);
      
    case "admin_cancel":
      // Admin-Stornierung
      return handleAdminCancel(e.parameter);
      
    case "admin_restore":
      // Admin-Wiederherstellung (Stornierung rückgängig)
      return handleAdminRestore(e.parameter);
      
    case "admin_add_booking":
      // Admin: Neue Buchung hinzufügen
      return handleAdminAddBooking(e.parameter);
      
    default:
      return jsonResponse({ ok: false, message: "Unbekannte Aktion" });
  }
}

/**
 * Buchung via GET-Request verarbeiten (Base64-kodierte Daten)
 */
function handleBookViaGet(base64Data) {
  try {
    if (!base64Data) {
      return jsonResponse({ 
        ok: false, 
        success: false, 
        error: "Keine Buchungsdaten übermittelt" 
      });
    }
    
    // Base64 dekodieren
    const jsonString = Utilities.newBlob(Utilities.base64Decode(base64Data)).getDataAsString("UTF-8");
    const payload = JSON.parse(jsonString);
    
    // An die normale Buchungsfunktion weiterleiten
    return handleBook(payload);
    
  } catch (error) {
    console.error("handleBookViaGet Fehler:", error);
    return jsonResponse({ 
      ok: false, 
      success: false, 
      error: "Fehler beim Verarbeiten der Buchung: " + error.message 
    });
  }
}

/**
 * HTTP POST Handler
 * Unterstützt sowohl application/json als auch text/plain (für CORS)
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    
    if (action === "book") {
      // Payload parsen (funktioniert für beide Content-Types)
      let payload;
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseError) {
        return jsonResponse({ 
          ok: false, 
          success: false,
          error: "Ungültige Anfrage-Daten" 
        });
      }
      
      return handleBook(payload);
    }
    
    return jsonResponse({ ok: false, success: false, message: "Unbekannte Aktion" });
    
  } catch (error) {
    console.error("doPost Fehler:", error);
    return jsonResponse({ 
      ok: false, 
      success: false, 
      error: "Server-Fehler: " + error.message 
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SLOTS ABRUFEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Alle Slots mit Verfügbarkeit zurückgeben (inkl. ausgebuchte)
 */
function handleGetSlots() {
  const sheet = getSheet(SHEET_SLOTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const slots = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Datum als YYYY-MM-DD String formatieren (lokale Zeitzone)
    const dateId = extractSlotDateId(row[0]);
    
    if (!dateId) continue; // Ungültige Zeilen überspringen
    
    const capacity = row[4] || 8;
    const booked = row[5] || 0;
    const status = row[6] || "OPEN";
    const free = capacity - booked;
    
    const slot = {
      slot_id: dateId,
      date: dateId,
      date_display: formatDateDisplay(row[0]),
      start: "09:00",
      end: "15:00",
      capacity: capacity,
      booked: booked,
      free: free,
      status: free <= 0 ? "FULL" : status  // Status automatisch auf FULL wenn ausgebucht
    };
    
    // ALLE Slots zurückgeben (auch ausgebuchte - Frontend zeigt sie rot an)
    slots.push(slot);
  }
  
  return jsonResponse({ ok: true, slots: slots });
}

/**
 * Datum für Anzeige formatieren (DD.MM.YYYY)
 */
function formatDateDisplay(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}.${m}.${y}`;
  }
  return extractSlotDateId(value);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHUNG DURCHFÜHREN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Buchung verarbeiten (mit Lock gegen Race Conditions)
 */
function handleBook(payload) {
  const lock = LockService.getScriptLock();
  
  try {
    // Lock erwerben (max 30 Sekunden warten)
    lock.waitLock(30000);
    
    // Validierung
    if (!payload.slot_id || !payload.contact_email || !payload.participants || payload.participants.length === 0) {
      return jsonResponse({ ok: false, message: "Unvollständige Buchungsdaten" });
    }
    
    if (!payload.agb_accepted || !payload.privacy_accepted) {
      return jsonResponse({ ok: false, message: "AGB und Datenschutz müssen akzeptiert werden" });
    }
    
    const participantCount = payload.participants.length;
    if (participantCount < 1 || participantCount > 8) {
      return jsonResponse({ ok: false, message: "Ungültige Teilnehmeranzahl (1-8)" });
    }
    
    // Slot prüfen - flexible Datumssuche
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    let slotRowIndex = -1;
    let slotData = null;
    
    const searchDate = extractSlotDateId(payload.slot_id);
    console.log("Suche nach Datum:", searchDate);
    
    for (let i = 1; i < slotsData.length; i++) {
      const slotDatePart = extractSlotDateId(slotsData[i][0]);
      
      // Vergleiche Datum-Teile (ignoriere Zeitzone)
      if (slotDatePart === searchDate) {
        slotRowIndex = i + 1; // 1-indexed für Sheet
        slotData = {
          slot_id: slotsData[i][0],
          date: slotsData[i][1],
          start: slotsData[i][2],
          end: slotsData[i][3],
          capacity: slotsData[i][4],
          booked: slotsData[i][5],
          status: slotsData[i][6]
        };
        console.log("Slot gefunden in Zeile:", slotRowIndex);
        break;
      }
    }
    
    if (!slotData) {
      return jsonResponse({ ok: false, message: "Termin nicht gefunden" });
    }
    
    if (slotData.status !== "OPEN") {
      return jsonResponse({ ok: false, message: "Termin nicht mehr verfügbar" });
    }
    
    const freeSlots = slotData.capacity - slotData.booked;
    if (participantCount > freeSlots) {
      return jsonResponse({ ok: false, message: `Nur noch ${freeSlots} Plätze verfügbar` });
    }
    
    // Buchung erstellen
    const bookingId = generateBookingId();
    const cancelToken = generateCancelToken();
    const timestamp = new Date().toISOString();
    
    // Booking eintragen (inkl. Gutscheincode)
    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    bookingsSheet.appendRow([
      bookingId,
      timestamp,
      payload.slot_id,
      payload.contact_email,
      payload.contact_phone || "",
      participantCount,
      "CONFIRMED",
      cancelToken,
      "", // cancelled_at
      false, // invoice_sent
      false, // appeared
      false, // membership_form
      false, // dsgvo_form
      "", // paid_date
      payload.voucher_code || "" // Gutscheincode
    ]);
    
    // Participants eintragen
    const participantsSheet = getSheet(SHEET_PARTICIPANTS);
    payload.participants.forEach((p, idx) => {
      participantsSheet.appendRow([
        bookingId,
        idx + 1,
        p.first_name,
        p.last_name,
        p.street,
        p.house_no,
        p.zip,
        p.city
      ]);
    });
    
    // Slot-Zähler erhöhen
    const newBooked = slotData.booked + participantCount;
    slotsSheet.getRange(slotRowIndex, 6).setValue(newBooked);
    
    // Falls voll, Status ändern
    if (newBooked >= slotData.capacity) {
      slotsSheet.getRange(slotRowIndex, 7).setValue("FULL");
    }
    
    // E-Mails senden (optional - falls Gmail nicht aktiviert ist, wird trotzdem gebucht)
    let emailSent = false;
    try {
      sendBookingConfirmationEmail(bookingId, payload, slotData, cancelToken);
      sendAdminNotificationEmail(bookingId, payload, slotData);
      emailSent = true;
      console.log("E-Mails erfolgreich gesendet");
    } catch (emailError) {
      console.warn("E-Mail-Versand fehlgeschlagen (Gmail nicht aktiviert?):", emailError.message);
      // Buchung ist trotzdem erfolgreich - nur E-Mail fehlt
    }
    
    return jsonResponse({ 
      ok: true, 
      booking_id: bookingId,
      message: emailSent ? "Buchung erfolgreich" : "Buchung erfolgreich (ohne E-Mail-Bestätigung)",
      email_sent: emailSent
    });
    
  } catch (error) {
    console.error("Buchungsfehler:", error);
    return jsonResponse({ ok: false, message: "Ein Fehler ist aufgetreten: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STORNIERUNG
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Buchung stornieren
 */
function handleCancel(token) {
  if (!token) {
    return jsonResponse({ ok: false, message: "Kein Stornierungstoken angegeben" });
  }
  
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);
    
    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    const bookingsData = bookingsSheet.getDataRange().getValues();
    
    let bookingRowIndex = -1;
    let bookingData = null;
    
    for (let i = 1; i < bookingsData.length; i++) {
      if (bookingsData[i][7] === token) { // cancel_token ist Spalte 8 (Index 7)
        bookingRowIndex = i + 1;
        bookingData = {
          booking_id: bookingsData[i][0],
          timestamp: bookingsData[i][1],
          slot_id: bookingsData[i][2],
          contact_email: bookingsData[i][3],
          contact_phone: bookingsData[i][4],
          participants_count: bookingsData[i][5],
          status: bookingsData[i][6],
          cancel_token: bookingsData[i][7],
          cancelled_at: bookingsData[i][8]
        };
        break;
      }
    }
    
    if (!bookingData) {
      return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    }
    
    // Bereits storniert?
    if (bookingData.status === "CANCELLED") {
      return jsonResponse({ 
        ok: true, 
        already_cancelled: true,
        booking_id: bookingData.booking_id,
        message: "Buchung war bereits storniert"
      });
    }
    
    // Stornierung durchführen
    const cancelledAt = new Date().toISOString();
    bookingsSheet.getRange(bookingRowIndex, 7).setValue("CANCELLED"); // status
    bookingsSheet.getRange(bookingRowIndex, 9).setValue(cancelledAt); // cancelled_at
    
    // Slot-Zähler reduzieren
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    for (let i = 1; i < slotsData.length; i++) {
      if (slotsData[i][0] === bookingData.slot_id) {
        const currentBooked = slotsData[i][5];
        const newBooked = Math.max(0, currentBooked - bookingData.participants_count);
        slotsSheet.getRange(i + 1, 6).setValue(newBooked);
        
        // Falls vorher voll, wieder öffnen
        if (slotsData[i][6] === "FULL" && newBooked < slotsData[i][4]) {
          slotsSheet.getRange(i + 1, 7).setValue("OPEN");
        }
        break;
      }
    }
    
    // E-Mails senden
    sendCancellationEmail(bookingData);
    sendAdminCancellationEmail(bookingData);
    
    return jsonResponse({ 
      ok: true, 
      booking_id: bookingData.booking_id,
      message: "Buchung erfolgreich storniert"
    });
    
  } catch (error) {
    console.error("Stornierungsfehler:", error);
    return jsonResponse({ ok: false, message: "Ein Fehler ist aufgetreten" });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN FUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Admin: Alle Buchungen abrufen
 */
function handleAdminBookings(adminKey) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!adminKey || adminKey !== correctKey) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  const bookingsData = bookingsSheet.getDataRange().getValues();
  
  const participantsSheet = getSheet(SHEET_PARTICIPANTS);
  const participantsData = participantsSheet.getDataRange().getValues();
  
  // Participants nach booking_id gruppieren
  const participantsByBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bookingId = participantsData[i][0];
    if (!participantsByBooking[bookingId]) {
      participantsByBooking[bookingId] = [];
    }
    participantsByBooking[bookingId].push({
      idx: participantsData[i][1],
      first_name: participantsData[i][2],
      last_name: participantsData[i][3],
      street: participantsData[i][4],
      house_no: participantsData[i][5],
      zip: participantsData[i][6],
      city: participantsData[i][7]
    });
  }
  
  // Buchungen zusammenstellen (inkl. Admin-Felder)
  const bookings = [];
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    const bookingId = row[0];
    
    // slot_id als YYYY-MM-DD String formatieren (konsistent mit handleGetSlots)
    const slotDateId = extractSlotDateId(row[2]);
    
    bookings.push({
      booking_id: bookingId,
      timestamp: row[1],
      slot_id: slotDateId,  // Konvertiert zu YYYY-MM-DD
      contact_email: row[3],
      contact_phone: row[4],
      participants_count: row[5],
      status: row[6],
      cancelled_at: row[8],
      // Admin-Felder (Spalten 10-15, Index 9-14)
      invoice_sent: row[9] === true || row[9] === "TRUE" || row[9] === "true",
      appeared: row[10] === true || row[10] === "TRUE" || row[10] === "true",
      membership_form: row[11] === true || row[11] === "TRUE" || row[11] === "true",
      dsgvo_form: row[12] === true || row[12] === "TRUE" || row[12] === "true",
      paid_date: row[13] || "",
      voucher_code: row[14] || "", // Gutscheincode
      // Teilnehmer
      participants: participantsByBooking[bookingId] || [],
      // Zeilennummer für Updates (1-indexed)
      row_index: i + 1
    });
  }
  
  return jsonResponse({ ok: true, bookings: bookings });
}

/**
 * Admin: CSV Export
 */
function handleAdminExportCsv(adminKey) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!adminKey || adminKey !== correctKey) {
    return ContentService.createTextOutput("Ungültiger Admin-Schlüssel");
  }
  
  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  const bookingsData = bookingsSheet.getDataRange().getValues();
  
  const participantsSheet = getSheet(SHEET_PARTICIPANTS);
  const participantsData = participantsSheet.getDataRange().getValues();
  
  // CSV Header
  let csv = "Buchungs-ID;Buchungsdatum;Termin;E-Mail;Handynummer;Teilnehmer;Status;Storniert am;TN-Nr;Vorname;Nachname;Strasse;Hausnr;PLZ;Ort\n";
  
  // Participants nach booking_id gruppieren
  const participantsByBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bookingId = participantsData[i][0];
    if (!participantsByBooking[bookingId]) {
      participantsByBooking[bookingId] = [];
    }
    participantsByBooking[bookingId].push(participantsData[i]);
  }
  
  // Zeilen erstellen
  for (let i = 1; i < bookingsData.length; i++) {
    const booking = bookingsData[i];
    const bookingId = booking[0];
    const slotDateId = extractSlotDateId(booking[2]); // Konvertiert zu YYYY-MM-DD
    const participants = participantsByBooking[bookingId] || [];
    
    if (participants.length > 0) {
      participants.forEach(p => {
        csv += [
          bookingId,
          booking[1], // timestamp
          slotDateId, // slot_id (formatiert)
          booking[3], // email
          booking[4], // phone
          booking[5], // count
          booking[6], // status
          booking[8] || "", // cancelled_at
          p[1], // idx
          p[2], // first_name
          p[3], // last_name
          p[4], // street
          p[5], // house_no
          p[6], // zip
          p[7]  // city
        ].join(";") + "\n";
      });
    } else {
      csv += [
        bookingId,
        booking[1],
        slotDateId,
        booking[3],
        booking[4],
        booking[5],
        booking[6],
        booking[8] || "",
        "", "", "", "", "", "", ""
      ].join(";") + "\n";
    }
  }
  
  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.CSV)
    .downloadAsFile("platzreife_buchungen.csv");
}

/**
 * Admin: Buchung aktualisieren (Checkboxen, Bezahldatum)
 */
function handleAdminUpdate(params) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!params.admin_key || params.admin_key !== correctKey) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const bookingId = params.booking_id;
  const field = params.field;
  const value = params.value;
  
  if (!bookingId || !field) {
    return jsonResponse({ ok: false, message: "Fehlende Parameter" });
  }
  
  // Erlaubte Felder
  const fieldMap = {
    "invoice_sent": 10,      // Spalte J (10)
    "appeared": 11,          // Spalte K (11)
    "membership_form": 12,   // Spalte L (12)
    "dsgvo_form": 13,        // Spalte M (13)
    "paid_date": 14          // Spalte N (14)
  };
  
  const colIndex = fieldMap[field];
  if (!colIndex) {
    return jsonResponse({ ok: false, message: "Ungültiges Feld: " + field });
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const sheet = getSheet(SHEET_BOOKINGS);
    const data = sheet.getDataRange().getValues();
    
    // Buchung finden
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bookingId) {
        rowIndex = i + 1; // 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    }
    
    // Wert setzen
    let finalValue = value;
    if (field !== "paid_date") {
      // Boolean für Checkboxen
      finalValue = (value === "true" || value === true);
    }
    
    sheet.getRange(rowIndex, colIndex).setValue(finalValue);
    
    console.log(`Buchung ${bookingId}: ${field} = ${finalValue}`);
    
    return jsonResponse({ ok: true, message: "Aktualisiert", booking_id: bookingId, field: field, value: finalValue });
    
  } catch (error) {
    console.error("Admin-Update Fehler:", error);
    return jsonResponse({ ok: false, message: "Fehler: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Admin: Buchung stornieren
 */
function handleAdminCancel(params) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!params.admin_key || params.admin_key !== correctKey) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const bookingId = params.booking_id;
  
  if (!bookingId) {
    return jsonResponse({ ok: false, message: "Keine Buchungs-ID angegeben" });
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const sheet = getSheet(SHEET_BOOKINGS);
    const data = sheet.getDataRange().getValues();
    
    // Buchung finden
    let rowIndex = -1;
    let currentStatus = "";
    let slotId = "";
    let participantCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bookingId) {
        rowIndex = i + 1;
        currentStatus = data[i][6];
        slotId = data[i][2];
        participantCount = data[i][5];
        break;
      }
    }
    
    if (rowIndex === -1) {
      return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    }
    
    if (currentStatus === "CANCELLED") {
      return jsonResponse({ ok: false, message: "Buchung bereits storniert" });
    }
    
    // Status auf CANCELLED setzen
    sheet.getRange(rowIndex, 7).setValue("CANCELLED");
    sheet.getRange(rowIndex, 9).setValue(new Date().toISOString()); // cancelled_at
    
    // Slot-Zähler reduzieren
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    // Slot per Datum finden (flexible Suche)
    const searchDate = extractSlotDateId(slotId);
    
    for (let i = 1; i < slotsData.length; i++) {
      const slotDatePart = extractSlotDateId(slotsData[i][0]);
      if (slotDatePart === searchDate) {
        const currentBooked = slotsData[i][5] || 0;
        const newBooked = Math.max(0, currentBooked - participantCount);
        slotsSheet.getRange(i + 1, 6).setValue(newBooked);
        
        // Status wieder auf OPEN setzen falls vorher FULL
        if (slotsData[i][6] === "FULL") {
          slotsSheet.getRange(i + 1, 7).setValue("OPEN");
        }
        break;
      }
    }
    
    console.log(`Admin-Stornierung: ${bookingId}`);
    
    return jsonResponse({ ok: true, message: "Buchung storniert", booking_id: bookingId });
    
  } catch (error) {
    console.error("Admin-Cancel Fehler:", error);
    return jsonResponse({ ok: false, message: "Fehler: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Admin: Stornierung rückgängig machen (Wiederherstellen)
 */
function handleAdminRestore(params) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!params.admin_key || params.admin_key !== correctKey) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const bookingId = params.booking_id;
  
  if (!bookingId) {
    return jsonResponse({ ok: false, message: "Keine Buchungs-ID angegeben" });
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const sheet = getSheet(SHEET_BOOKINGS);
    const data = sheet.getDataRange().getValues();
    
    // Buchung finden
    let rowIndex = -1;
    let currentStatus = "";
    let slotId = "";
    let participantCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === bookingId) {
        rowIndex = i + 1;
        currentStatus = data[i][6];
        slotId = data[i][2];
        participantCount = data[i][5];
        break;
      }
    }
    
    if (rowIndex === -1) {
      return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    }
    
    if (currentStatus !== "CANCELLED") {
      return jsonResponse({ ok: false, message: "Buchung ist nicht storniert" });
    }
    
    // Prüfen ob Slot noch Platz hat
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    const searchDate = extractSlotDateId(slotId);
    let slotRowIndex = -1;
    let slotCapacity = 0;
    let slotBooked = 0;
    
    for (let i = 1; i < slotsData.length; i++) {
      const slotDatePart = extractSlotDateId(slotsData[i][0]);
      if (slotDatePart === searchDate) {
        slotRowIndex = i + 1;
        slotCapacity = slotsData[i][4] || 8;
        slotBooked = slotsData[i][5] || 0;
        break;
      }
    }
    
    if (slotRowIndex === -1) {
      return jsonResponse({ ok: false, message: "Termin nicht mehr vorhanden" });
    }
    
    const freeSlots = slotCapacity - slotBooked;
    if (participantCount > freeSlots) {
      return jsonResponse({ ok: false, message: `Nur noch ${freeSlots} Plätze frei. Buchung hat ${participantCount} Teilnehmer.` });
    }
    
    // Status auf CONFIRMED setzen
    sheet.getRange(rowIndex, 7).setValue("CONFIRMED");
    sheet.getRange(rowIndex, 9).setValue(""); // cancelled_at löschen
    
    // Slot-Zähler erhöhen
    const newBooked = slotBooked + participantCount;
    slotsSheet.getRange(slotRowIndex, 6).setValue(newBooked);
    
    // Falls voll, Status ändern
    if (newBooked >= slotCapacity) {
      slotsSheet.getRange(slotRowIndex, 7).setValue("FULL");
    }
    
    console.log(`Admin-Wiederherstellung: ${bookingId}`);
    
    return jsonResponse({ ok: true, message: "Buchung wiederhergestellt", booking_id: bookingId });
    
  } catch (error) {
    console.error("Admin-Restore Fehler:", error);
    return jsonResponse({ ok: false, message: "Fehler: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Admin: Neue Buchung manuell hinzufügen
 */
function handleAdminAddBooking(params) {
  const correctKey = getSetting("ADMIN_KEY");
  
  if (!params.admin_key || params.admin_key !== correctKey) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  // Base64-kodierte Daten dekodieren
  if (!params.data) {
    return jsonResponse({ ok: false, message: "Keine Buchungsdaten übermittelt" });
  }
  
  try {
    const jsonString = Utilities.newBlob(Utilities.base64Decode(params.data)).getDataAsString("UTF-8");
    const payload = JSON.parse(jsonString);
    
    // Validierung
    if (!payload.slot_id) {
      return jsonResponse({ ok: false, message: "Kein Termin ausgewählt" });
    }
    
    if (!payload.participants || payload.participants.length === 0) {
      return jsonResponse({ ok: false, message: "Keine Teilnehmer angegeben" });
    }
    
    const participantCount = payload.participants.length;
    
    // Slot prüfen
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    const searchDate = extractSlotDateId(payload.slot_id);
    console.log("Admin-Buchung: Suche nach Datum:", searchDate);
    
    let slotRowIndex = -1;
    let slotData = null;
    
    for (let i = 1; i < slotsData.length; i++) {
      const slotDatePart = extractSlotDateId(slotsData[i][0]);
      console.log(`  Slot ${i}: ${slotsData[i][0]} -> ${slotDatePart}`);
      
      if (slotDatePart === searchDate) {
        slotRowIndex = i + 1;
        slotData = {
          slot_id: slotsData[i][0],
          capacity: slotsData[i][4] || 8,
          booked: slotsData[i][5] || 0
        };
        console.log("  -> Gefunden!");
        break;
      }
    }
    
    if (!slotData) {
      console.log("Kein Slot gefunden für:", searchDate);
      return jsonResponse({ ok: false, message: "Termin nicht gefunden: " + searchDate });
    }
    
    const freeSlots = slotData.capacity - slotData.booked;
    if (participantCount > freeSlots) {
      return jsonResponse({ ok: false, message: `Nur noch ${freeSlots} Plätze verfügbar` });
    }
    
    // Buchung erstellen
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    
    try {
      const bookingId = generateBookingId();
      const timestamp = new Date().toISOString();
      
      // Booking eintragen (mit Admin-Markierung, inkl. Gutscheincode)
      const bookingsSheet = getSheet(SHEET_BOOKINGS);
      bookingsSheet.appendRow([
        bookingId,
        timestamp,
        payload.slot_id,
        payload.contact_email || "admin@metzenhof.at",
        payload.contact_phone || "",
        participantCount,
        "CONFIRMED",
        "", // cancel_token (leer bei Admin-Buchung)
        "", // cancelled_at
        false, // invoice_sent
        false, // appeared
        false, // membership_form
        false, // dsgvo_form
        "",    // paid_date
        payload.voucher_code || "" // Gutscheincode
      ]);
      
      // Participants eintragen
      const participantsSheet = getSheet(SHEET_PARTICIPANTS);
      payload.participants.forEach((p, idx) => {
        participantsSheet.appendRow([
          bookingId,
          idx + 1,
          p.first_name || "",
          p.last_name || "",
          p.street || "",
          p.house_no || "",
          p.zip || "",
          p.city || ""
        ]);
      });
      
      // Slot-Zähler erhöhen
      const newBooked = slotData.booked + participantCount;
      slotsSheet.getRange(slotRowIndex, 6).setValue(newBooked);
      
      if (newBooked >= slotData.capacity) {
        slotsSheet.getRange(slotRowIndex, 7).setValue("FULL");
      }
      
      console.log(`Admin-Buchung erstellt: ${bookingId}`);
      
      return jsonResponse({ 
        ok: true, 
        booking_id: bookingId,
        message: "Buchung erfolgreich erstellt"
      });
      
    } finally {
      lock.releaseLock();
    }
    
  } catch (error) {
    console.error("Admin-AddBooking Fehler:", error);
    return jsonResponse({ ok: false, message: "Fehler: " + error.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// E-MAIL FUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Buchungsbestätigung an Kunde senden
 */
function sendBookingConfirmationEmail(bookingId, payload, slotData, cancelToken) {
  const baseUrl = getSetting("PUBLIC_BASE_URL") || "https://example.github.io/platzreife";
  const fromName = getSetting("MAIL_FROM_NAME") || "gemma golfn";
  const cancelUrl = `${baseUrl}/cancel.html?token=${cancelToken}`;
  
  const participantsList = payload.participants.map((p, i) => 
    `${i + 1}. ${p.first_name} ${p.last_name}`
  ).join("\n");
  
  const subject = `Buchungsbestätigung – Platzreife-Kurs am ${formatDateForEmail(slotData.date)}`;
  
  const body = `
Hallo,

vielen Dank für Ihre Buchung beim Golfclub Metzenhof!

═══════════════════════════════════════
BUCHUNGSDETAILS
═══════════════════════════════════════

Buchungs-ID: ${bookingId}
Termin: ${formatDateForEmail(slotData.date)}
Uhrzeit: ${slotData.start}–${slotData.end} Uhr
Teilnehmer: ${payload.participants.length}

${participantsList}

═══════════════════════════════════════
WICHTIGE INFORMATIONEN
═══════════════════════════════════════

• Bitte erscheinen Sie ca. 15 Minuten vor Kursbeginn
• Leihschläger sind kostenfrei verfügbar
• Bitte tragen Sie angemessene Golfkleidung
• Die Zahlung erfolgt vor Ort

═══════════════════════════════════════
STORNIERUNG
═══════════════════════════════════════

Falls Sie die Buchung stornieren möchten:
${cancelUrl}

Kostenfreie Stornierung bis 7 Tage vor Kursbeginn möglich.

═══════════════════════════════════════

Bei Fragen erreichen Sie uns unter:
E-Mail: info@metzenhof.at
Telefon: +43 7225 7389

Wir freuen uns auf Sie!

Ihr Team vom Golfclub Metzenhof
„mitanaund genießen"

--
Golfplatz Kronstorf-Steyr BetriebsgesmbH
Dörfling 2, 4484 Kronstorf
www.metzenhof.at
  `.trim();
  
  GmailApp.sendEmail(payload.contact_email, subject, body, {
    name: fromName
  });
}

/**
 * Admin-Benachrichtigung bei neuer Buchung
 */
function sendAdminNotificationEmail(bookingId, payload, slotData) {
  const adminEmail = getSetting("ADMIN_EMAIL") || "info@metzenhof.at";
  
  const participantsList = payload.participants.map((p, i) => 
    `${i + 1}. ${p.first_name} ${p.last_name}, ${p.street} ${p.house_no}, ${p.zip} ${p.city}`
  ).join("\n");
  
  const subject = `[Neue Buchung] ${bookingId} – ${formatDateForEmail(slotData.date)}`;
  
  const body = `
Neue Platzreife-Buchung eingegangen!

Buchungs-ID: ${bookingId}
Termin: ${formatDateForEmail(slotData.date)}, ${slotData.start}–${slotData.end} Uhr
E-Mail: ${payload.contact_email}
Telefon: ${payload.contact_phone || "–"}
Teilnehmer: ${payload.participants.length}

${participantsList}
  `.trim();
  
  GmailApp.sendEmail(adminEmail, subject, body);
}

/**
 * Stornierungsbestätigung an Kunde senden
 */
function sendCancellationEmail(bookingData) {
  const fromName = getSetting("MAIL_FROM_NAME") || "gemma golfn";
  
  const subject = `Stornierungsbestätigung – Buchung ${bookingData.booking_id}`;
  
  const body = `
Hallo,

Ihre Buchung wurde erfolgreich storniert.

Buchungs-ID: ${bookingData.booking_id}
Storniert am: ${new Date().toLocaleString("de-AT")}

Bei Fragen erreichen Sie uns unter:
E-Mail: info@metzenhof.at
Telefon: +43 7225 7389

Ihr Team vom Golfclub Metzenhof
  `.trim();
  
  GmailApp.sendEmail(bookingData.contact_email, subject, body, {
    name: fromName
  });
}

/**
 * Admin-Benachrichtigung bei Stornierung
 */
function sendAdminCancellationEmail(bookingData) {
  const adminEmail = getSetting("ADMIN_EMAIL") || "info@metzenhof.at";
  
  const subject = `[Stornierung] ${bookingData.booking_id}`;
  
  const body = `
Buchung storniert!

Buchungs-ID: ${bookingData.booking_id}
Termin: ${bookingData.slot_id}
E-Mail: ${bookingData.contact_email}
Teilnehmer: ${bookingData.participants_count}
Storniert am: ${new Date().toLocaleString("de-AT")}
  `.trim();
  
  GmailApp.sendEmail(adminEmail, subject, body);
}

// ══════════════════════════════════════════════════════════════════════════════
// SEEDER FUNKTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PRÜF- UND REPARATURFUNKTION
 * Zählt alle Buchungen und korrigiert die booked-Werte in der Slots-Tabelle
 * Diese Funktion manuell im Script-Editor ausführen!
 * ══════════════════════════════════════════════════════════════════════════════
 */
/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DIAGNOSE-FUNKTION: Überprüft Daten auf Unstimmigkeiten
 * Führe diese Funktion im Script-Editor aus, um einen Bericht zu erhalten.
 * ÄNDERT KEINE DATEN - nur Analyse!
 * ══════════════════════════════════════════════════════════════════════════════
 */
function diagnoseData() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔍 DATENDIAGNOSE - Überprüfung aller Tabellen");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  const ss = getSpreadsheet();
  const slotsSheet = ss.getSheetByName(SHEET_SLOTS);
  const bookingsSheet = ss.getSheetByName(SHEET_BOOKINGS);
  const participantsSheet = ss.getSheetByName(SHEET_PARTICIPANTS);
  
  let errors = [];
  let warnings = [];
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BUCHUNGEN ANALYSIEREN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("📋 1. BUCHUNGEN-TABELLE");
  console.log("─────────────────────────────────────────────────────────────");
  
  const bookingsData = bookingsSheet.getDataRange().getValues();
  const bookingsHeaders = bookingsData[0];
  console.log("   Header: " + bookingsHeaders.join(", "));
  console.log("   Zeilen: " + (bookingsData.length - 1) + " Buchungen\n");
  
  const slotIdColIdx = bookingsHeaders.indexOf("slot_id");
  const statusColIdx = bookingsHeaders.indexOf("status");
  const countColIdx = bookingsHeaders.indexOf("participants_count");
  const bookingIdColIdx = bookingsHeaders.indexOf("booking_id");
  const voucherColIdx = bookingsHeaders.indexOf("voucher_code");
  
  // Buchungen pro Slot zählen
  const bookingsBySlot = {};
  let totalConfirmed = 0;
  let totalCancelled = 0;
  let totalParticipants = 0;
  let bookingsWithVoucher = 0;
  
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    const bookingId = row[bookingIdColIdx];
    const status = row[statusColIdx];
    const slotDateId = extractSlotDateId(row[slotIdColIdx]);
    const participantCount = parseInt(row[countColIdx]) || 1;
    const voucher = voucherColIdx >= 0 ? row[voucherColIdx] : "";
    
    if (status === "CONFIRMED") {
      totalConfirmed++;
      totalParticipants += participantCount;
      
      if (!bookingsBySlot[slotDateId]) {
        bookingsBySlot[slotDateId] = { count: 0, participants: 0, bookings: [] };
      }
      bookingsBySlot[slotDateId].count++;
      bookingsBySlot[slotDateId].participants += participantCount;
      bookingsBySlot[slotDateId].bookings.push(bookingId);
    } else if (status === "CANCELLED") {
      totalCancelled++;
    }
    
    if (voucher) bookingsWithVoucher++;
  }
  
  console.log("   ✓ Bestätigte Buchungen: " + totalConfirmed);
  console.log("   ✕ Stornierte Buchungen: " + totalCancelled);
  console.log("   👥 Gesamte Teilnehmer (bestätigt): " + totalParticipants);
  console.log("   🎟️ Buchungen mit Gutschein: " + bookingsWithVoucher);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SLOTS ANALYSIEREN UND VERGLEICHEN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n\n📅 2. SLOTS-TABELLE (Vergleich mit Buchungen)");
  console.log("─────────────────────────────────────────────────────────────");
  
  const slotsData = slotsSheet.getDataRange().getValues();
  console.log("   Header: " + slotsData[0].join(", "));
  console.log("   Zeilen: " + (slotsData.length - 1) + " Termine\n");
  
  console.log("   Termin          | Kapazität | Gebucht (Sheets) | Gebucht (tatsächlich) | Status    | Prüfung");
  console.log("   ────────────────┼───────────┼──────────────────┼───────────────────────┼───────────┼─────────");
  
  for (let i = 1; i < slotsData.length; i++) {
    const row = slotsData[i];
    const slotId = extractSlotDateId(row[0]);
    const capacity = parseInt(row[4]) || 8;
    const bookedInSheet = parseInt(row[5]) || 0;
    const statusInSheet = row[6] || "OPEN";
    
    const actualBooked = bookingsBySlot[slotId] ? bookingsBySlot[slotId].participants : 0;
    const correctStatus = actualBooked >= capacity ? "FULL" : "OPEN";
    
    let check = "✓ OK";
    if (bookedInSheet !== actualBooked) {
      check = "❌ BOOKED FALSCH";
      errors.push(`Slot ${slotId}: booked=${bookedInSheet}, sollte ${actualBooked} sein`);
    } else if (statusInSheet !== correctStatus) {
      check = "⚠️ STATUS FALSCH";
      warnings.push(`Slot ${slotId}: status=${statusInSheet}, sollte ${correctStatus} sein`);
    }
    
    console.log(`   ${slotId}   |     ${String(capacity).padStart(2)}    |        ${String(bookedInSheet).padStart(2)}        |          ${String(actualBooked).padStart(2)}           | ${statusInSheet.padEnd(9)} | ${check}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TEILNEHMER ANALYSIEREN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n\n👥 3. TEILNEHMER-TABELLE");
  console.log("─────────────────────────────────────────────────────────────");
  
  const participantsData = participantsSheet.getDataRange().getValues();
  console.log("   Header: " + participantsData[0].join(", "));
  console.log("   Zeilen: " + (participantsData.length - 1) + " Teilnehmer-Einträge\n");
  
  // Teilnehmer pro Buchung zählen
  const participantsByBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bookingId = participantsData[i][0];
    if (!participantsByBooking[bookingId]) {
      participantsByBooking[bookingId] = 0;
    }
    participantsByBooking[bookingId]++;
  }
  
  // Vergleich mit Buchungen
  let participantMismatches = 0;
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    const bookingId = row[bookingIdColIdx];
    const declaredCount = parseInt(row[countColIdx]) || 1;
    const actualCount = participantsByBooking[bookingId] || 0;
    
    if (declaredCount !== actualCount) {
      participantMismatches++;
      warnings.push(`Buchung ${bookingId}: participants_count=${declaredCount}, aber ${actualCount} Teilnehmer in Tabelle`);
    }
  }
  
  console.log("   Teilnehmer-Einträge gesamt: " + (participantsData.length - 1));
  console.log("   Unstimmigkeiten: " + participantMismatches);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ZUSAMMENFASSUNG
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("📊 ZUSAMMENFASSUNG");
  console.log("═══════════════════════════════════════════════════════════");
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log("\n✅ ALLES IN ORDNUNG! Keine Unstimmigkeiten gefunden.");
  } else {
    if (errors.length > 0) {
      console.log("\n❌ FEHLER (" + errors.length + "):");
      errors.forEach(e => console.log("   • " + e));
    }
    if (warnings.length > 0) {
      console.log("\n⚠️ WARNUNGEN (" + warnings.length + "):");
      warnings.forEach(w => console.log("   • " + w));
    }
    console.log("\n💡 Führe recalculateBookedCounts() aus, um die Daten zu korrigieren.");
  }
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🏁 Diagnose abgeschlossen");
  console.log("═══════════════════════════════════════════════════════════");
  
  return { errors, warnings };
}

/**
 * Zählt Buchungen neu und korrigiert die Slots-Tabelle
 * Führe diese Funktion aus, um Fehler zu beheben.
 */
function recalculateBookedCounts() {
  const ss = getSpreadsheet();
  const slotsSheet = ss.getSheetByName(SHEET_SLOTS);
  const bookingsSheet = ss.getSheetByName(SHEET_BOOKINGS);
  
  if (!slotsSheet || !bookingsSheet) {
    console.log("❌ Sheets nicht gefunden!");
    return;
  }
  
  // Alle Buchungen laden
  const bookingsData = bookingsSheet.getDataRange().getValues();
  const bookingsHeaders = bookingsData[0];
  
  // Spalten-Index finden
  const slotIdColIdx = bookingsHeaders.indexOf("slot_id");
  const statusColIdx = bookingsHeaders.indexOf("status");
  const countColIdx = bookingsHeaders.indexOf("participants_count");
  
  console.log("📊 Buchungen analysieren...");
  console.log(`   Spalten: slot_id=${slotIdColIdx}, status=${statusColIdx}, count=${countColIdx}`);
  
  // Zähler pro Slot-Datum erstellen
  const bookingCounts = {};
  
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    const status = row[statusColIdx];
    
    // Nur CONFIRMED Buchungen zählen (nicht CANCELLED)
    if (status !== "CONFIRMED") {
      continue;
    }
    
    // Slot-ID extrahieren (als YYYY-MM-DD)
    const rawSlotId = row[slotIdColIdx];
    const slotDateId = extractSlotDateId(rawSlotId);
    
    if (!slotDateId) {
      console.log(`   ⚠️ Zeile ${i+1}: Ungültiges Datum: ${rawSlotId}`);
      continue;
    }
    
    const participantCount = parseInt(row[countColIdx]) || 1;
    
    if (!bookingCounts[slotDateId]) {
      bookingCounts[slotDateId] = 0;
    }
    bookingCounts[slotDateId] += participantCount;
    
    console.log(`   Zeile ${i+1}: ${slotDateId} +${participantCount} Teilnehmer (Status: ${status})`);
  }
  
  console.log("\n📅 Gezählte Buchungen pro Termin:");
  for (const [date, count] of Object.entries(bookingCounts)) {
    console.log(`   ${date}: ${count} Teilnehmer`);
  }
  
  // Slots-Tabelle aktualisieren
  const slotsData = slotsSheet.getDataRange().getValues();
  console.log("\n🔧 Slots-Tabelle aktualisieren...");
  
  let fixedCount = 0;
  
  for (let i = 1; i < slotsData.length; i++) {
    const row = slotsData[i];
    const slotId = extractSlotDateId(row[0]); // slot_id
    const capacity = row[4] || 8;
    const currentBooked = row[5] || 0;
    const currentStatus = row[6] || "OPEN";
    
    const actualBooked = bookingCounts[slotId] || 0;
    const correctStatus = actualBooked >= capacity ? "FULL" : "OPEN";
    
    // Nur ändern wenn nötig
    if (currentBooked !== actualBooked || currentStatus !== correctStatus) {
      console.log(`   ${slotId}: booked ${currentBooked} → ${actualBooked}, status ${currentStatus} → ${correctStatus}`);
      
      // Zeile aktualisieren (Zeile i+1 wegen 1-basiertem Index)
      slotsSheet.getRange(i + 1, 6).setValue(actualBooked);  // booked (Spalte F)
      slotsSheet.getRange(i + 1, 7).setValue(correctStatus); // status (Spalte G)
      fixedCount++;
    } else {
      console.log(`   ${slotId}: ✓ OK (booked=${actualBooked}, status=${correctStatus})`);
    }
  }
  
  console.log(`\n✅ Fertig! ${fixedCount} Slots korrigiert.`);
  
  return {
    bookingCounts: bookingCounts,
    fixedSlots: fixedCount
  };
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ALLE SLOTS LÖSCHEN UND NEU ANLEGEN
 * Diese Funktion manuell im Script-Editor ausführen!
 * ACHTUNG: Löscht ALLE bestehenden Slots!
 * ══════════════════════════════════════════════════════════════════════════════
 */
function resetAndSeedSlots2026() {
  // Neue Termine mit Kapazitäten (Stand: Januar 2026)
  const slotsData = [
    { date: "2026-02-28", capacity: 9 },
    { date: "2026-03-07", capacity: 9 },
    { date: "2026-03-14", capacity: 9 },
    { date: "2026-03-21", capacity: 9 },
    { date: "2026-03-28", capacity: 9 },
    { date: "2026-04-04", capacity: 9 },
    { date: "2026-04-18", capacity: 9 },
    { date: "2026-04-25", capacity: 9 },
    { date: "2026-05-01", capacity: 9 },
    { date: "2026-05-02", capacity: 9 },
    { date: "2026-05-16", capacity: 9 },
    { date: "2026-05-30", capacity: 9 },
    { date: "2026-06-13", capacity: 9 },
    { date: "2026-06-20", capacity: 9 },
    { date: "2026-06-27", capacity: 9 },
    { date: "2026-07-04", capacity: 9 },
    { date: "2026-07-18", capacity: 9 },
    { date: "2026-08-01", capacity: 9 },
    { date: "2026-08-08", capacity: 9 },
    { date: "2026-08-15", capacity: 9 },
    { date: "2026-08-22", capacity: 22 },
    { date: "2026-08-29", capacity: 9 },
    { date: "2026-09-05", capacity: 9 },
    { date: "2026-09-19", capacity: 9 },
    { date: "2026-10-03", capacity: 18 },
    { date: "2026-10-17", capacity: 18 }
  ];
  
  const sheet = getSheet(SHEET_SLOTS);
  
  // ALLE Daten löschen (außer Header falls vorhanden)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
    console.log(`${lastRow - 1} alte Zeilen gelöscht.`);
  }
  
  // Header setzen (falls leer)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["slot_id", "date", "start", "end", "capacity", "booked", "status"]);
  }
  
  // Neue Slots einfügen
  slotsData.forEach(slot => {
    sheet.appendRow([
      slot.date,      // slot_id = Datum
      slot.date,      // date
      "09:00",        // start
      "15:00",        // end
      slot.capacity,  // capacity (variabel!)
      0,              // booked
      "OPEN"          // status
    ]);
  });
  
  console.log(`✅ ${slotsData.length} neue Slots für 2026 angelegt!`);
  console.log("Termine:");
  slotsData.forEach(s => console.log(`  ${s.date} - Kapazität: ${s.capacity}`));
}

/**
 * Alte Funktion (nicht mehr verwenden)
 * @deprecated Verwende resetAndSeedSlots2026() stattdessen
 */
function seedSlots2026() {
  console.log("⚠️ Diese Funktion ist veraltet! Verwende resetAndSeedSlots2026() stattdessen.");
  resetAndSeedSlots2026();
}

/**
 * Settings initialisieren
 * Diese Funktion manuell im Script-Editor ausführen!
 */
function initSettings() {
  const sheet = getSheet(SHEET_SETTINGS);
  
  // Header setzen (falls leer)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["key", "value"]);
  }
  
  // Default Settings
  const settings = [
    ["ADMIN_EMAIL", "info@metzenhof.at"],
    ["MAIL_FROM_NAME", "gemma golfn"],
    ["ADMIN_KEY", "CHANGE_THIS_SECRET_KEY"],
    ["PUBLIC_BASE_URL", "https://DEIN_USERNAME.github.io/platzreife"]
  ];
  
  settings.forEach(s => {
    sheet.appendRow(s);
  });
  
  console.log("Settings initialisiert! Bitte ADMIN_KEY und PUBLIC_BASE_URL anpassen.");
}

/**
 * Sheet-Struktur initialisieren
 * Diese Funktion manuell im Script-Editor ausführen!
 */
function initSheets() {
  const ss = getSpreadsheet();
  
  // Slots Sheet
  let slotsSheet = ss.getSheetByName(SHEET_SLOTS);
  if (!slotsSheet) {
    slotsSheet = ss.insertSheet(SHEET_SLOTS);
    slotsSheet.appendRow(["slot_id", "date", "start", "end", "capacity", "booked", "status"]);
  }
  
  // Bookings Sheet - mit Admin-Feldern und Gutscheincode
  let bookingsSheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bookingsSheet) {
    bookingsSheet = ss.insertSheet(SHEET_BOOKINGS);
    bookingsSheet.appendRow([
      "booking_id", "timestamp", "slot_id", "contact_email", "contact_phone", 
      "participants_count", "status", "cancel_token", "cancelled_at",
      "invoice_sent", "appeared", "membership_form", "dsgvo_form", "paid_date",
      "voucher_code"
    ]);
  }
  
  // Participants Sheet
  let participantsSheet = ss.getSheetByName(SHEET_PARTICIPANTS);
  if (!participantsSheet) {
    participantsSheet = ss.insertSheet(SHEET_PARTICIPANTS);
    participantsSheet.appendRow(["booking_id", "idx", "first_name", "last_name", "street", "house_no", "zip", "city"]);
  }
  
  // Settings Sheet
  let settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS);
    settingsSheet.appendRow(["key", "value"]);
  }
  
  console.log("Alle Sheets initialisiert!");
}

/**
 * Bestehende Bookings Sheet um neue Admin-Spalten erweitern
 * Einmalig ausführen für bestehende Sheets!
 */
function upgradeBookingsSheet() {
  const sheet = getSheet(SHEET_BOOKINGS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Prüfen ob neue Spalten schon existieren
  if (!headers.includes("invoice_sent")) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue("invoice_sent");
    sheet.getRange(1, lastCol + 2).setValue("appeared");
    sheet.getRange(1, lastCol + 3).setValue("membership_form");
    sheet.getRange(1, lastCol + 4).setValue("dsgvo_form");
    sheet.getRange(1, lastCol + 5).setValue("paid_date");
    console.log("Bookings Sheet um Admin-Spalten erweitert!");
  } else {
    console.log("Admin-Spalten bereits vorhanden.");
  }
}

