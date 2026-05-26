const form = document.querySelector("#partForm");
const saveState = document.querySelector("#saveState");
const partsList = document.querySelector("#partsList");
const partCount = document.querySelector("#partCount");
const searchInput = document.querySelector("#searchInput");
const techniciansList = document.querySelector("#techniciansList");
const addTechnicianButton = document.querySelector("#addTechnicianButton");
const hoursCheck = document.querySelector("#hoursCheck");
const config = window.PARTES_CONFIG || {};

const fields = {
  fecha: document.querySelector("#fecha"),
  cliente: document.querySelector("#cliente"),
  direccion: document.querySelector("#direccion"),
  tipoServicio: Array.from(document.querySelectorAll('input[name="tipoServicio"]')),
  jefeObra: document.querySelector("#jefeObra"),
  firmaCliente: document.querySelector("#firmaCliente"),
  anioOt: document.querySelector("#anioOt"),
  ot: document.querySelector("#ot"),
  horaInicio: document.querySelector("#horaInicio"),
  horaFinal: document.querySelector("#horaFinal"),
  horasJornada: document.querySelector("#horasJornada"),
  horasUrgencia: document.querySelector("#horasUrgencia"),
  descripcion: document.querySelector("#descripcion"),
  observaciones: document.querySelector("#observaciones"),
  almuerzo: document.querySelector("#almuerzo"),
  comida: document.querySelector("#comida"),
  tiempoComida: document.querySelector("#tiempoComida"),
  km: document.querySelector("#km"),
  prima: document.querySelector("#prima"),
  busca: document.querySelector("#busca"),
  nocturnidad: document.querySelector("#nocturnidad"),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function setState(text) {
  saveState.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function technicianRows() {
  return Array.from(techniciansList.querySelectorAll(".technician-row"));
}

function technicianInputs() {
  return Array.from(techniciansList.querySelectorAll(".technician-name"));
}

function updateTechnicianRemoveButtons() {
  const rows = technicianRows();
  rows.forEach((row) => {
    row.querySelector(".remove-technician").disabled = rows.length === 1;
  });
}

function addTechnicianInput(nombre = "", dni = "", shouldFocus = false) {
  const index = technicianRows().length + 1;
  const row = document.createElement("div");
  row.className = "technician-row";
  row.innerHTML = `
    <label>
      <span class="visually-hidden">Técnico ${index}</span>
      <input class="technician-name" name="tecnico" type="text" placeholder="Nombre del técnico" required>
    </label>
    <label>
      <span class="visually-hidden">DNI técnico ${index}</span>
      <input class="technician-dni" name="dniTecnico" type="text" placeholder="DNI" required>
    </label>
    <button class="button text-button remove-technician" type="button" aria-label="Quitar técnico">×</button>
  `;
  row.querySelector(".technician-name").value = nombre;
  row.querySelector(".technician-dni").value = dni;
  techniciansList.appendChild(row);
  updateTechnicianRemoveButtons();
  if (shouldFocus) row.querySelector(".technician-name").focus();
}

function setTechnicians(values = [{ nombre: "", dni: "" }]) {
  techniciansList.innerHTML = "";
  values.forEach((item) => addTechnicianInput(item.nombre, item.dni));
}

function getTechnicians() {
  return technicianRows()
    .map((row) => ({
      nombre: row.querySelector(".technician-name").value.trim(),
      dni: row.querySelector(".technician-dni").value.trim().toUpperCase(),
    }))
    .filter((item) => item.nombre || item.dni);
}

function focusFirstTechnician() {
  const row = technicianRows().find((item) => (
    !item.querySelector(".technician-name").value.trim() ||
    !item.querySelector(".technician-dni").value.trim()
  )) || technicianRows()[0];
  row?.querySelector(".technician-name").focus();
}

function getTipoServicio() {
  return fields.tipoServicio.find((input) => input.checked)?.value || "";
}

function setTipoServicio(value) {
  fields.tipoServicio.forEach((input) => {
    input.checked = input.value === value;
  });
}

function resetForm() {
  form.reset();
  fields.fecha.value = today();
  fields.anioOt.value = new Date().getFullYear().toString();
  setTipoServicio("");
  setTechnicians();
  updateMealMinutes();
  updateHoursCheck();
  setState("Sin guardar");
}

function formToPart() {
  return {
    fecha: fields.fecha.value,
    tecnicos: getTechnicians(),
    cliente: fields.cliente.value.trim(),
    instalacion: fields.direccion.value.trim(),
    direccion: fields.direccion.value.trim(),
    tipoServicio: getTipoServicio(),
    jefeObra: fields.jefeObra.value,
    firmaCliente: fields.firmaCliente.value.trim().toUpperCase(),
    anioOt: fields.anioOt.value.trim(),
    ot: fields.ot.value.trim(),
    horaInicio: fields.horaInicio.value,
    horaFinal: fields.horaFinal.value,
    horasJornada: fields.horasJornada.value,
    horasUrgencia: fields.horasUrgencia.value,
    descripcion: fields.descripcion.value.trim(),
    observaciones: fields.observaciones.value.trim(),
    almuerzo: fields.almuerzo.checked,
    comida: fields.comida.checked,
    tiempoComida: fields.tiempoComida.value,
    km: fields.km.value,
    prima: fields.prima.value,
    busca: fields.busca.checked,
    nocturnidad: fields.nocturnidad.checked,
  };
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

function declaredHours(part) {
  return toNumber(part.horasJornada) + toNumber(part.horasUrgencia) + (Number(part.tiempoComida || 0) / 60);
}

function getAutoMealMinutes() {
  return (fields.comida.checked ? 60 : 0) + (fields.almuerzo.checked ? 30 : 0);
}

function updateMealMinutes() {
  const minutes = getAutoMealMinutes();
  fields.tiempoComida.value = minutes ? String(minutes) : "";
  updateHoursCheck();
}

function updateHoursCheck() {
  const part = formToPart();
  const realHours = hoursBetween(part.horaInicio, part.horaFinal);
  const totalDeclared = declaredHours(part);

  if (realHours === null || !part.horasJornada) {
    hoursCheck.className = "hours-check";
    hoursCheck.textContent = "Introduce hora de entrada, hora de salida y horas declaradas para comprobar el parte.";
    return;
  }

  const difference = totalDeclared - realHours;
  const message = `Entrada/salida: ${realHours.toFixed(2)} h · Declaradas: ${totalDeclared.toFixed(2)} h`;
  if (Math.abs(difference) <= 0.25) {
    hoursCheck.className = "hours-check ok";
    hoursCheck.textContent = `${message}. Correcto.`;
  } else {
    hoursCheck.className = "hours-check error";
    hoursCheck.textContent = `${message}. Diferencia: ${difference.toFixed(2)} h.`;
  }
}

function validatePart(part) {
  const required = [
    [fields.fecha, part.fecha, "Falta fecha"],
    [fields.cliente, part.cliente, "Falta cliente"],
    [fields.horaInicio, part.horaInicio, "Falta hora inicio"],
    [fields.horaFinal, part.horaFinal, "Falta hora final"],
    [fields.horasJornada, part.horasJornada, "Faltan horas jornada"],
    [fields.descripcion, part.descripcion, "Falta descripción"],
  ];

  if (!part.tecnicos.length || part.tecnicos.some((tecnico) => !tecnico.nombre || !tecnico.dni)) {
    focusFirstTechnician();
    return "Cada técnico debe tener nombre y DNI.";
  }

  for (const [field, value, message] of required) {
    if (!value) {
      field.focus();
      return message;
    }
  }

  const realHours = hoursBetween(part.horaInicio, part.horaFinal);
  const totalDeclared = declaredHours(part);
  if (realHours !== null && Math.abs(realHours - totalDeclared) > 0.25) {
    fields.horasJornada.focus();
    return `Las horas no cuadran: entre entrada y salida hay ${realHours.toFixed(2)} h, pero has declarado ${totalDeclared.toFixed(2)} h.`;
  }

  return "";
}

async function savePart(part) {
  if (!config.APPS_SCRIPT_URL) {
    throw new Error("Falta configurar APPS_SCRIPT_URL en public/config.js.");
  }

  const response = await fetch(config.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify(part),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "No se ha podido guardar el parte.");
  }
  return payload;
}

function renderStatusCard(title, details = "") {
  partsList.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${details ? `<p>${escapeHtml(details)}</p>` : ""}
    </div>
  `;
}

async function checkHealth() {
  partCount.textContent = config.APPS_SCRIPT_URL ? "OK" : "Config";
  searchInput.value = config.APPS_SCRIPT_URL
    ? "Google Apps Script configurado"
    : "Falta configurar Apps Script";
  renderStatusCard(
    config.APPS_SCRIPT_URL ? "Listo para guardar" : "Configuración pendiente",
    config.APPS_SCRIPT_URL
      ? "Los partes se enviarán a Google Apps Script y se insertarán en Google Sheets."
      : "Pega la URL del despliegue de Apps Script en public/config.js."
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const part = formToPart();
  const validationError = validatePart(part);
  if (validationError) {
    setState("Revisar");
    alert(validationError);
    return;
  }

  try {
    setState("Guardando");
    const result = await savePart(part);
    setState("Guardado");
    renderStatusCard("Parte guardado", `Mes ${result.month}. Filas añadidas: ${result.rowsAdded}.`);
    resetForm();
    setState("Guardado");
  } catch (error) {
    setState("Error");
    alert(error.message);
  }
});

document.querySelector("#newPartButton").addEventListener("click", resetForm);

addTechnicianButton.addEventListener("click", () => {
  addTechnicianInput("", "", true);
});

[
  fields.horaInicio,
  fields.horaFinal,
  fields.horasJornada,
  fields.horasUrgencia,
  fields.tiempoComida,
].forEach((field) => {
  field.addEventListener("input", updateHoursCheck);
  field.addEventListener("change", updateHoursCheck);
});

fields.comida.addEventListener("change", updateMealMinutes);
fields.almuerzo.addEventListener("change", updateMealMinutes);

techniciansList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-technician");
  if (!button) return;
  const rows = technicianRows();
  const row = button.closest(".technician-row");
  if (rows.length === 1) {
    row.querySelector(".technician-name").value = "";
    row.querySelector(".technician-dni").value = "";
    return;
  }
  row.remove();
  updateTechnicianRemoveButtons();
});

resetForm();
checkHealth();
