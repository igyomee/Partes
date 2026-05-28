const SHEET_HEADERS = [
  "Timestamp Guardado",
  "NºAlbarán",
  "Mes",
  "Fecha Trabajo",
  "Cliente",
  "Instalación",
  "Código Operario",
  "Operario",
  "DNI Operario",
  "Tipo Servicio",
  "Jefe de Obra",
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
  "Materiales",
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
    message: "Apps Script de partes digitales activo. Version con Jefe de Obra.",
  });
}

function actualizarEncabezados() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.getSheets().forEach((sheet) => {
    if (/^\d{4}-\d{2}$/.test(sheet.getName())) {
      ensureSheetHeaders(sheet);
    }
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
    const albaranNumber = getNextAlbaranNumber(sheet, monthName);
    const rows = buildRows(part, monthName, albaranNumber);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SHEET_HEADERS.length).setValues(rows);

    return jsonResponse({
      ok: true,
      message: "Parte guardado en Google Sheets.",
      month: monthName,
      albaran: albaranNumber,
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
      codigo: cleanText(item && item.codigo, 20),
      nombre: cleanText(item && (item.nombre || item.name || item), 120),
      dni: cleanText(item && item.dni, 30).toUpperCase(),
    })).filter((item) => item.codigo || item.nombre || item.dni),
    cliente: cleanText(raw.cliente, 200),
    instalacion: cleanText(raw.instalacion || raw.direccion, 300),
    direccion: cleanText(raw.direccion || raw.instalacion, 300),
    tipoServicio: cleanText(raw.tipoServicio, 80),
    jefeObra: cleanText(raw.jefeObra, 20).toUpperCase(),
    firmaCliente: cleanText(raw.firmaCliente, 30).toUpperCase(),
    anioOt: cleanText(raw.anioOt, 20),
    ot: cleanText(raw.ot, 80),
    horaInicio: cleanText(raw.horaInicio, 10),
    horaFinal: cleanText(raw.horaFinal, 10),
    horasJornada: cleanNumberText(raw.horasJornada),
    horasUrgencia: cleanNumberText(raw.horasUrgencia),
    descripcion: cleanText(raw.descripcion, 5000),
    materiales: cleanText(raw.materiales || raw.observaciones, 5000),
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
  if (part.tecnicos.some((tecnico) => !tecnico.codigo || !tecnico.nombre || !tecnico.dni)) return "Cada técnico debe tener código, nombre y DNI.";
  if (!part.cliente) return "El cliente es obligatorio.";
  if (!part.jefeObra) return "El jefe de obra es obligatorio.";
  if (parseTimeToMinutes(part.horaInicio) === null) return "La hora de entrada no es válida.";
  if (parseTimeToMinutes(part.horaFinal) === null) return "La hora de salida no es válida.";
  if (!isHalfHourTime(part.horaInicio)) return "La hora de entrada debe ir de media hora en media hora.";
  if (!isHalfHourTime(part.horaFinal)) return "La hora de salida debe ir de media hora en media hora.";
  if (!part.horasJornada) return "Las horas de jornada son obligatorias.";
  if (toNumber(part.horasJornada) > 8) return "Las horas de jornada no pueden ser más de 8.";
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

function isHalfHourTime(value) {
  const minutes = parseTimeToMinutes(value);
  return minutes !== null && minutes % 30 === 0;
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

function getAlbaranPrefix(monthName) {
  const parts = String(monthName || "").split("-");
  return parts[1] + "-" + parts[0].slice(-2);
}

function formatAlbaran(prefix, sequence) {
  return prefix + "-" + String(sequence).padStart(2, "0");
}

function getNextAlbaranNumber(sheet, monthName) {
  const prefix = getAlbaranPrefix(monthName);
  const headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), SHEET_HEADERS.length)).getValues()[0];
  const albaranColumnIndex = headerRow.indexOf("NºAlbarán") + 1;
  if (!albaranColumnIndex || sheet.getLastRow() < 2) {
    return formatAlbaran(prefix, 1);
  }

  const values = sheet.getRange(2, albaranColumnIndex, sheet.getLastRow() - 1, 1).getValues();
  const pattern = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-(\\d+)$");
  const maxSequence = values.reduce((max, row) => {
    const match = String(row[0] || "").trim().match(pattern);
    if (!match) return max;
    const sequence = Number(match[1]);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return formatAlbaran(prefix, maxSequence + 1);
}

function getOrCreateMonthlySheet(monthName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(monthName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(monthName);
    ensureSheetHeaders(sheet);
    return sheet;
  }

  ensureSheetHeaders(sheet);
  return sheet;
}

function ensureSheetHeaders(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), SHEET_HEADERS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const albaranIndex = currentHeaders.indexOf("NºAlbarán");
  const codigoOperarioIndex = currentHeaders.indexOf("Código Operario");
  const operarioIndex = currentHeaders.indexOf("Operario");
  const tipoServicioIndex = currentHeaders.indexOf("Tipo Servicio");
  const jefeObraIndex = currentHeaders.indexOf("Jefe de Obra");

  if (albaranIndex === -1) {
    sheet.insertColumnAfter(1);
    currentHeaders.splice(1, 0, "NºAlbarán");
  }

  if (operarioIndex !== -1 && codigoOperarioIndex === -1) {
    const updatedOperarioIndex = currentHeaders.indexOf("Operario");
    sheet.insertColumnBefore(updatedOperarioIndex + 1);
    currentHeaders.splice(updatedOperarioIndex, 0, "Código Operario");
  }

  if (tipoServicioIndex !== -1 && jefeObraIndex === -1) {
    const updatedTipoServicioIndex = currentHeaders.indexOf("Tipo Servicio");
    sheet.insertColumnAfter(updatedTipoServicioIndex + 1);
  }

  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  sheet.setFrozenRows(1);
}

function buildRows(part, monthName, albaranNumber) {
  const timestamp = new Date().toISOString();
  const declaredHours = getDeclaredHours(part).toFixed(2);
  const realHours = hoursBetween(part.horaInicio, part.horaFinal);

  return part.tecnicos.map((tecnico) => [
    timestamp,
    albaranNumber,
    monthName,
    part.fecha,
    part.cliente,
    part.instalacion,
    tecnico.codigo,
    tecnico.nombre,
    tecnico.dni,
    part.tipoServicio,
    part.jefeObra,
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
    part.materiales,
    part.km,
    part.prima,
    part.busca ? "Si" : "No",
    part.nocturnidad ? "Si" : "No",
    "",
    part.firmaCliente,
    PROCESSING_PENDING,
    "",
    "",
    "",
  ]);
}
