const SHEET_HEADERS = [
  "Timestamp Guardado",
  "Mes",
  "Fecha Trabajo",
  "Cliente",
  "Instalación",
  "Operario",
  "DNI Operario",
  "Tipo Servicio",
  "Año OT",
  "OT",
  "Hora Entrada",
  "Hora Salida",
  "Horas Jornada",
  "Horas Adicionales",
  "Tiempo Comida",
  "Almuerzo",
  "Comida",
  "Total Horas Declaradas",
  "Total Horas Reales",
  "Descripción Trabajo",
  "Observaciones",
  "KM",
  "Prima",
  "Busca",
  "Nocturnidad",
  "Firma Técnico",
  "Firma Cliente",
  "Estado Procesado",
  "Fecha Procesado",
  "PDF Generado",
  "Error Procesamiento",
];

const PROCESSING_PENDING = "Pendiente";

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Apps Script de partes digitales activo.",
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    const part = normalizePart(payload);
    const validationError = validatePart(part);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const monthName = getMonthName(part.fecha);
    const sheet = getOrCreateMonthlySheet(monthName);
    const rows = buildRows(part, monthName);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SHEET_HEADERS.length).setValues(rows);

    return jsonResponse({
      ok: true,
      message: "Parte guardado en Google Sheets.",
      month: monthName,
      rowsAdded: rows.length,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : "No se ha podido guardar el parte.",
    }, 500);
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanText(value, maxLength) {
  const limit = maxLength || 5000;
  return String(value == null ? "" : value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, limit);
}

function cleanNumberText(value) {
  const text = cleanText(value, 30).replace(",", ".");
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : "";
}

function normalizePart(raw) {
  const tecnicos = Array.isArray(raw.tecnicos) ? raw.tecnicos : [];
  return {
    fecha: cleanText(raw.fecha, 10),
    tecnicos: tecnicos.map((item) => ({
      nombre: cleanText(item && (item.nombre || item.name || item), 120),
      dni: cleanText(item && item.dni, 30).toUpperCase(),
    })).filter((item) => item.nombre || item.dni),
    cliente: cleanText(raw.cliente, 200),
    instalacion: cleanText(raw.instalacion || raw.direccion, 300),
    direccion: cleanText(raw.direccion || raw.instalacion, 300),
    tipoServicio: cleanText(raw.tipoServicio, 80),
    anioOt: cleanText(raw.anioOt, 20),
    ot: cleanText(raw.ot, 80),
    horaInicio: cleanText(raw.horaInicio, 10),
    horaFinal: cleanText(raw.horaFinal, 10),
    horasJornada: cleanNumberText(raw.horasJornada),
    horasUrgencia: cleanNumberText(raw.horasUrgencia),
    descripcion: cleanText(raw.descripcion, 5000),
    observaciones: cleanText(raw.observaciones, 5000),
    almuerzo: Boolean(raw.almuerzo),
    comida: Boolean(raw.comida),
    tiempoComida: cleanText(raw.tiempoComida, 10),
    km: cleanNumberText(raw.km),
    prima: cleanText(raw.prima, 50),
    busca: Boolean(raw.busca),
    nocturnidad: Boolean(raw.nocturnidad),
  };
}

function validatePart(part) {
  if (!part.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(part.fecha)) return "La fecha de trabajo es obligatoria.";
  if (!part.tecnicos.length) return "Debe indicarse al menos un técnico.";
  if (part.tecnicos.some((tecnico) => !tecnico.nombre || !tecnico.dni)) return "Cada técnico debe tener nombre y DNI.";
  if (!part.cliente) return "El cliente es obligatorio.";
  if (parseTimeToMinutes(part.horaInicio) === null) return "La hora de entrada no es válida.";
  if (parseTimeToMinutes(part.horaFinal) === null) return "La hora de salida no es válida.";
  if (!part.horasJornada) return "Las horas de jornada son obligatorias.";
  if (!part.descripcion) return "La descripción de trabajo es obligatoria.";

  const realHours = hoursBetween(part.horaInicio, part.horaFinal);
  const declared = getDeclaredHours(part);
  if (realHours !== null && Math.abs(realHours - declared) > 0.25) {
    return "Las horas no cuadran: entre entrada y salida hay " + realHours.toFixed(2) + " h, pero has declarado " + declared.toFixed(2) + " h.";
  }
  return "";
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hoursBetween(start, end) {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function toNumber(value) {
  if (!value) return 0;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function getDeclaredHours(part) {
  return toNumber(part.horasJornada) + toNumber(part.horasUrgencia) + (Number(part.tiempoComida || 0) / 60);
}

function getMonthName(date) {
  return cleanText(date, 10).slice(0, 7);
}

function getOrCreateMonthlySheet(monthName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(monthName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(monthName);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const needsHeaders = SHEET_HEADERS.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buildRows(part, monthName) {
  const timestamp = new Date().toISOString();
  const declaredHours = getDeclaredHours(part).toFixed(2);
  const realHours = hoursBetween(part.horaInicio, part.horaFinal);

  return part.tecnicos.map((tecnico) => [
    timestamp,
    monthName,
    part.fecha,
    part.cliente,
    part.instalacion,
    tecnico.nombre,
    tecnico.dni,
    part.tipoServicio,
    part.anioOt,
    part.ot,
    part.horaInicio,
    part.horaFinal,
    part.horasJornada,
    part.horasUrgencia || "0",
    part.tiempoComida,
    part.almuerzo ? "Si" : "No",
    part.comida ? "Si" : "No",
    declaredHours,
    realHours === null ? "" : realHours.toFixed(2),
    part.descripcion,
    part.observaciones,
    part.km,
    part.prima,
    part.busca ? "Si" : "No",
    part.nocturnidad ? "Si" : "No",
    "",
    "",
    PROCESSING_PENDING,
    "",
    "",
    "",
  ]);
}
