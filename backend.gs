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
 * Datum formatieren für E-Mail
 */
function formatDateForEmail(dateStr) {
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const [year, month, day] = dateStr.split("-");
  const date = new Date(year, month - 1, day);
  const weekday = weekdays[date.getDay()];
  return `${weekday}, ${day}.${month}.${year}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// API ENDPUNKTE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * HTTP GET Handler
 */
function doGet(e) {
  const action = e.parameter.action;
  
  switch (action) {
    case "slots":
      return handleGetSlots();
    case "cancel":
      return handleCancel(e.parameter.token);
    case "admin_bookings":
      return handleAdminBookings(e.parameter.admin_key);
    case "admin_export_csv":
      return handleAdminExportCsv(e.parameter.admin_key);
    default:
      return jsonResponse({ ok: false, message: "Unbekannte Aktion" });
  }
}

/**
 * HTTP POST Handler
 */
function doPost(e) {
  const action = e.parameter.action;
  
  if (action === "book") {
    const payload = JSON.parse(e.postData.contents);
    return handleBook(payload);
  }
  
  return jsonResponse({ ok: false, message: "Unbekannte Aktion" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLOTS ABRUFEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Alle Slots mit Verfügbarkeit zurückgeben
 */
function handleGetSlots() {
  const sheet = getSheet(SHEET_SLOTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const slots = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const slot = {
      slot_id: row[0],
      date: row[1],
      start: row[2],
      end: row[3],
      capacity: row[4],
      booked: row[5],
      status: row[6]
    };
    
    // Nur offene Slots
    if (slot.status === "OPEN") {
      slot.free = slot.capacity - slot.booked;
      slots.push(slot);
    }
  }
  
  return jsonResponse({ ok: true, slots: slots });
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
    
    // Slot prüfen
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    let slotRowIndex = -1;
    let slotData = null;
    
    for (let i = 1; i < slotsData.length; i++) {
      if (slotsData[i][0] === payload.slot_id) {
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
    
    // Booking eintragen
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
      "" // cancelled_at
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
    
    // E-Mails senden
    sendBookingConfirmationEmail(bookingId, payload, slotData, cancelToken);
    sendAdminNotificationEmail(bookingId, payload, slotData);
    
    return jsonResponse({ 
      ok: true, 
      booking_id: bookingId,
      message: "Buchung erfolgreich"
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
  
  // Buchungen zusammenstellen
  const bookings = [];
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    const bookingId = row[0];
    bookings.push({
      booking_id: bookingId,
      timestamp: row[1],
      slot_id: row[2],
      contact_email: row[3],
      contact_phone: row[4],
      participants_count: row[5],
      status: row[6],
      cancelled_at: row[8],
      participants: participantsByBooking[bookingId] || []
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
    const participants = participantsByBooking[bookingId] || [];
    
    if (participants.length > 0) {
      participants.forEach(p => {
        csv += [
          bookingId,
          booking[1], // timestamp
          booking[2], // slot_id
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
        booking[2],
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
 * Slots für 2026 initialisieren
 * Diese Funktion manuell im Script-Editor ausführen!
 */
function seedSlots2026() {
  const dates = [
    "2026-02-25", "2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28",
    "2026-04-04", "2026-04-18", "2026-04-25", "2026-05-01", "2026-05-02",
    "2026-05-16", "2026-05-30", "2026-06-13", "2026-06-20", "2026-06-27",
    "2026-07-04", "2026-07-18", "2026-08-01", "2026-08-08", "2026-08-15",
    "2026-08-22", "2026-08-29", "2026-09-05", "2026-09-19", "2026-10-03",
    "2026-10-17"
  ];
  
  const sheet = getSheet(SHEET_SLOTS);
  
  // Header setzen (falls leer)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["slot_id", "date", "start", "end", "capacity", "booked", "status"]);
  }
  
  // Slots einfügen
  dates.forEach(date => {
    sheet.appendRow([
      date,        // slot_id = Datum
      date,        // date
      "09:00",     // start
      "15:00",     // end
      8,           // capacity
      0,           // booked
      "OPEN"       // status
    ]);
  });
  
  console.log(`${dates.length} Slots für 2026 angelegt!`);
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
  
  // Bookings Sheet
  let bookingsSheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bookingsSheet) {
    bookingsSheet = ss.insertSheet(SHEET_BOOKINGS);
    bookingsSheet.appendRow(["booking_id", "timestamp", "slot_id", "contact_email", "contact_phone", "participants_count", "status", "cancel_token", "cancelled_at"]);
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

