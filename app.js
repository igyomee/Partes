const form = document.querySelector("#partForm");
const partIdInput = document.querySelector("#partId");
const saveState = document.querySelector("#saveState");
const partsList = document.querySelector("#partsList");
const partCount = document.querySelector("#partCount");
const searchInput = document.querySelector("#searchInput");
const printArea = document.querySelector("#printArea");
const deleteButton = document.querySelector("#deleteButton");
const techniciansList = document.querySelector("#techniciansList");
const addTechnicianButton = document.querySelector("#addTechnicianButton");
const signaturesList = document.querySelector("#signaturesList");
const clientSignatureCanvas = document.querySelector("#clientSignatureCanvas");
const clearClientSignatureButton = document.querySelector("#clearClientSignatureButton");

const fields = {
  fecha: document.querySelector("#fecha"),
  cliente: document.querySelector("#cliente"),
  direccion: document.querySelector("#direccion"),
  tipoServicio: Array.from(document.querySelectorAll('input[name="tipoServicio"]')),
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

let partes = [];
let activeSignatureCanvas = null;
let activePointerId = null;

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

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatOt(part) {
  if (!part.ot) return "";
  return part.anioOt ? `${part.anioOt}/${part.ot}` : part.ot;
}

function getTipoServicio() {
  return fields.tipoServicio.find((input) => input.checked)?.value || "";
}

function setTipoServicio(value) {
  fields.tipoServicio.forEach((input) => {
    input.checked = input.value === value;
  });
}

function technicianInputs() {
  return Array.from(techniciansList.querySelectorAll(".technician-input"));
}

function technicianRows() {
  return Array.from(techniciansList.querySelectorAll(".technician-row"));
}

function signatureCanvases() {
  return Array.from(signaturesList.querySelectorAll(".signature-canvas"));
}

function updateTechnicianRemoveButtons() {
  const rows = technicianRows();
  rows.forEach((row) => {
    row.querySelector(".remove-technician").disabled = rows.length === 1;
  });
}

function clearSignatureCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas.dataset.dirty = "false";
}

function drawSignatureOnCanvas(canvas, dataUrl) {
  clearSignatureCanvas(canvas);
  if (!dataUrl) return;
  const image = new Image();
  image.onload = () => {
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.dataset.dirty = "true";
  };
  image.src = dataUrl;
}

function getSignatureDataByRow() {
  return signatureCanvases().map((canvas) => (
    canvas.dataset.dirty === "true" ? canvas.toDataURL("image/png") : ""
  ));
}

function getClientSignatureData() {
  return clientSignatureCanvas.dataset.dirty === "true"
    ? clientSignatureCanvas.toDataURL("image/png")
    : "";
}

function updateSignatureTitles() {
  const inputs = technicianInputs();
  const titles = Array.from(signaturesList.querySelectorAll(".signature-title"));
  titles.forEach((title, index) => {
    const name = inputs[index]?.value.trim();
    title.textContent = `Firma ${name || `Técnico ${index + 1}`}`;
  });
}

function syncSignatureBoxes(signatureData = getSignatureDataByRow()) {
  const count = Math.max(technicianInputs().length, 1);
  signaturesList.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const card = document.createElement("article");
    card.className = "signature-card";
    card.innerHTML = `
      <div class="signature-head">
        <span class="signature-title">Firma Técnico ${index + 1}</span>
        <button class="button text-button clear-signature-button" type="button">Borrar firma</button>
      </div>
      <canvas class="signature-canvas" width="720" height="220" aria-label="Firma técnico ${index + 1}"></canvas>
    `;
    signaturesList.appendChild(card);
    drawSignatureOnCanvas(card.querySelector(".signature-canvas"), signatureData[index] || "");
  }

  updateSignatureTitles();
}

function addTechnicianInput(value = "", shouldFocus = false, shouldSyncSignatures = true) {
  const existingSignatures = getSignatureDataByRow();
  const index = technicianInputs().length + 1;
  const row = document.createElement("div");
  row.className = "technician-row";
  row.innerHTML = `
    <label>
      <span class="visually-hidden">Técnico ${index}</span>
      <input class="technician-input" name="tecnico" type="text" placeholder="Nombre del técnico">
    </label>
    <button class="button text-button remove-technician" type="button" aria-label="Quitar técnico">×</button>
  `;
  const input = row.querySelector(".technician-input");
  input.value = value;
  techniciansList.appendChild(row);
  updateTechnicianRemoveButtons();
  if (shouldSyncSignatures) syncSignatureBoxes(existingSignatures);
  if (shouldFocus) input.focus();
}

function getPartSignatures(part) {
  if (Array.isArray(part.firmas)) return part.firmas;
  return part.firma ? [part.firma] : [];
}

function setTechnicians(names, signatures = []) {
  techniciansList.innerHTML = "";
  const values = Array.isArray(names) && names.length ? names : [""];
  values.forEach((name) => addTechnicianInput(name, false, false));
  updateTechnicianRemoveButtons();
  syncSignatureBoxes(signatures);
}

function getTechnicianEntries() {
  return technicianInputs()
    .map((input, index) => ({ index, name: input.value.trim() }))
    .filter((entry) => entry.name);
}

function getTechnicians() {
  return getTechnicianEntries().map((entry) => entry.name);
}

function focusFirstTechnician() {
  const emptyInput = technicianInputs().find((input) => !input.value.trim());
  const firstInput = emptyInput || technicianInputs()[0];
  if (firstInput) firstInput.focus();
}

function emptyPart() {
  return {
    id: "",
    fecha: today(),
    tecnicos: [],
    cliente: "",
    direccion: "",
    tipoServicio: "",
    anioOt: new Date().getFullYear().toString(),
    ot: "",
    horaInicio: "",
    horaFinal: "",
    horasJornada: "",
    horasUrgencia: "",
    descripcion: "",
    observaciones: "",
    almuerzo: false,
    comida: false,
    tiempoComida: "",
    km: "",
    prima: "",
    busca: false,
    nocturnidad: false,
    firma: "",
    firmas: [],
    firmaCliente: "",
  };
}

function formToPart() {
  const entries = getTechnicianEntries();
  const signaturesByRow = getSignatureDataByRow();
  const firmas = entries.map((entry) => signaturesByRow[entry.index] || "");

  return {
    id: partIdInput.value,
    fecha: fields.fecha.value,
    tecnicos: entries.map((entry) => entry.name),
    cliente: fields.cliente.value.trim(),
    direccion: fields.direccion.value.trim(),
    tipoServicio: getTipoServicio(),
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
    firma: firmas[0] || "",
    firmas,
    firmaCliente: getClientSignatureData(),
  };
}

function partToForm(part) {
  partIdInput.value = part.id || "";
  fields.fecha.value = part.fecha || today();
  setTechnicians(part.tecnicos || [], getPartSignatures(part));
  fields.cliente.value = part.cliente || "";
  fields.direccion.value = part.direccion || "";
  setTipoServicio(part.tipoServicio || "");
  fields.anioOt.value = part.anioOt || new Date().getFullYear().toString();
  fields.ot.value = part.ot || "";
  fields.horaInicio.value = part.horaInicio || "";
  fields.horaFinal.value = part.horaFinal || "";
  fields.horasJornada.value = part.horasJornada || "";
  fields.horasUrgencia.value = part.horasUrgencia || "";
  fields.descripcion.value = part.descripcion || "";
  fields.observaciones.value = part.observaciones || "";
  fields.almuerzo.checked = Boolean(part.almuerzo);
  fields.comida.checked = Boolean(part.comida);
  fields.tiempoComida.value = part.tiempoComida || "";
  fields.km.value = part.km || "";
  fields.prima.value = part.prima || "";
  fields.busca.checked = Boolean(part.busca);
  fields.nocturnidad.checked = Boolean(part.nocturnidad);
  drawSignatureOnCanvas(clientSignatureCanvas, part.firmaCliente || "");
  deleteButton.disabled = !part.id;
  setState(part.id ? "Editando" : "Sin guardar");
  renderList();
}

function focusSignature(index) {
  const canvas = signatureCanvases()[index];
  if (canvas) {
    canvas.scrollIntoView({ behavior: "smooth", block: "center" });
    canvas.focus?.();
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

  if (!part.tecnicos.length) {
    focusFirstTechnician();
    setState("Falta técnico");
    return false;
  }

  for (const [field, value, message] of required) {
    if (!value) {
      field.focus();
      setState(message);
      return false;
    }
  }

  const missingSignatureIndex = part.firmas.findIndex((firma) => !firma);
  if (missingSignatureIndex >= 0) {
    focusSignature(missingSignatureIndex);
    setState("Falta firma");
    return false;
  }

  return true;
}

async function loadPartes() {
  const response = await fetch("/api/partes");
  if (!response.ok) throw new Error("No se han podido cargar los partes");
  partes = await response.json();
  renderList();
}

async function savePart(part) {
  const isUpdate = Boolean(part.id);
  const response = await fetch(isUpdate ? `/api/partes/${part.id}` : "/api/partes", {
    method: isUpdate ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(part),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se ha podido guardar");
  return payload;
}

async function deletePart(id) {
  const response = await fetch(`/api/partes/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error || "No se ha podido eliminar");
  }
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedId = partIdInput.value;
  const filtered = partes.filter((part) => {
    const text = [
      part.fecha,
      part.cliente,
      part.direccion,
      part.tipoServicio,
      part.ot,
      part.anioOt,
      ...(part.tecnicos || []),
    ].join(" ").toLowerCase();
    return text.includes(query);
  });

  partCount.textContent = partes.length;
  if (!filtered.length) {
    partsList.innerHTML = '<div class="empty-state">No hay partes para mostrar.</div>';
    return;
  }

  partsList.innerHTML = filtered.map((part) => {
    const technicians = (part.tecnicos || []).join(", ") || "Sin técnicos";
    const ot = formatOt(part);
    return `
      <button class="part-item ${part.id === selectedId ? "active" : ""}" type="button" data-id="${escapeHtml(part.id)}">
        <strong>${escapeHtml(formatDate(part.fecha))} - ${escapeHtml(technicians)}</strong>
        ${ot ? `<span class="part-meta"><span>OT ${escapeHtml(ot)}</span></span>` : ""}
      </button>
    `;
  }).join("");
}

function renderPrint(part) {
  const checks = [
    `Almuerzo: ${part.almuerzo ? "Si" : "No"}`,
    `Comida: ${part.comida ? "Si" : "No"}`,
    `T. comida: ${part.tiempoComida || ""}`,
    `Busca: ${part.busca ? "Si" : "No"}`,
    `Nocturnidad: ${part.nocturnidad ? "Si" : "No"}`,
  ].join(" · ");
  const firmas = getPartSignatures(part);
  const signatureBoxes = (part.tecnicos || []).map((tecnico, index) => `
    <div class="print-signature-box">
      <span class="print-label">Firma ${escapeHtml(tecnico)}</span>
      ${firmas[index] ? `<img src="${firmas[index]}" alt="Firma ${escapeHtml(tecnico)}">` : ""}
    </div>
  `).join("");
  const clientSignatureBox = `
    <div class="print-signature-box">
      <span class="print-label">Firma cliente</span>
      ${part.firmaCliente ? `<img src="${part.firmaCliente}" alt="Firma cliente">` : ""}
    </div>
  `;

  printArea.innerHTML = `
    <article class="print-sheet">
      <header class="print-title">
        <div>
          <h1>Parte de trabajo</h1>
          <strong>${escapeHtml(formatDate(part.fecha))}</strong>
        </div>
        <div>
          <span class="print-label">Técnicos</span>
          ${escapeHtml((part.tecnicos || []).join(", "))}
        </div>
      </header>
      <div class="print-grid">
        <div class="print-cell wide"><span class="print-label">Cliente</span>${escapeHtml(part.cliente)}</div>
        <div class="print-cell wide"><span class="print-label">Dirección</span>${escapeHtml(part.direccion)}</div>
        <div class="print-cell wide"><span class="print-label">Tipo de servicio</span>${escapeHtml(part.tipoServicio)}</div>
        <div class="print-cell"><span class="print-label">Año OT</span>${escapeHtml(part.anioOt)}</div>
        <div class="print-cell"><span class="print-label">OT</span>${escapeHtml(part.ot)}</div>
        <div class="print-cell"><span class="print-label">Hora inicio</span>${escapeHtml(part.horaInicio)}</div>
        <div class="print-cell"><span class="print-label">Hora final</span>${escapeHtml(part.horaFinal)}</div>
        <div class="print-cell"><span class="print-label">Horas jornada</span>${escapeHtml(part.horasJornada)}</div>
        <div class="print-cell"><span class="print-label">Horas urgencia</span>${escapeHtml(part.horasUrgencia)}</div>
        <div class="print-cell"><span class="print-label">KM</span>${escapeHtml(part.km)}</div>
        <div class="print-cell"><span class="print-label">Prima</span>${escapeHtml(part.prima)}</div>
        <div class="print-cell wide"><span class="print-label">Opciones</span>${escapeHtml(checks)}</div>
        <div class="print-cell full"><span class="print-label">Descripción trabajo</span>${escapeHtml(part.descripcion).replace(/\n/g, "<br>")}</div>
        <div class="print-cell full"><span class="print-label">Obs.</span>${escapeHtml(part.observaciones).replace(/\n/g, "<br>")}</div>
      </div>
      <section class="print-signature">
        ${signatureBoxes}
        ${clientSignatureBox}
      </section>
    </article>
  `;
}

function resetForm() {
  partToForm(emptyPart());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const part = formToPart();
  if (!validatePart(part)) return;

  try {
    setState("Guardando");
    const saved = await savePart(part);
    await loadPartes();
    partToForm(saved);
    setState("Guardado");
  } catch (error) {
    setState("Error");
    alert(error.message);
  }
});

document.querySelector("#newPartButton").addEventListener("click", resetForm);

document.querySelector("#exportExcelButton").addEventListener("click", () => {
  window.location.href = "/api/resumen.xlsx";
});

document.querySelector("#printButton").addEventListener("click", async () => {
  const part = formToPart();
  if (!validatePart(part)) return;

  if (!part.id) {
    try {
      setState("Guardando");
      const saved = await savePart(part);
      await loadPartes();
      partToForm(saved);
      renderPrint(saved);
    } catch (error) {
      setState("Error");
      alert(error.message);
      return;
    }
  } else {
    renderPrint(part);
  }
  window.print();
});

deleteButton.addEventListener("click", async () => {
  const id = partIdInput.value;
  if (!id) return;
  const ok = confirm("Eliminar este parte?");
  if (!ok) return;
  try {
    await deletePart(id);
    await loadPartes();
    resetForm();
  } catch (error) {
    alert(error.message);
  }
});

partsList.addEventListener("click", (event) => {
  const item = event.target.closest(".part-item");
  if (!item) return;
  const part = partes.find((candidate) => candidate.id === item.dataset.id);
  if (part) partToForm(part);
});

searchInput.addEventListener("input", renderList);

addTechnicianButton.addEventListener("click", () => {
  addTechnicianInput("", true);
});

techniciansList.addEventListener("input", (event) => {
  if (event.target.matches(".technician-input")) updateSignatureTitles();
});

techniciansList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-technician");
  if (!button) return;
  const rows = technicianRows();
  const row = button.closest(".technician-row");
  const rowIndex = rows.indexOf(row);
  const signatures = getSignatureDataByRow();
  signatures.splice(rowIndex, 1);

  if (rows.length === 1) {
    row.querySelector(".technician-input").value = "";
    syncSignatureBoxes([]);
    return;
  }

  row.remove();
  updateTechnicianRemoveButtons();
  syncSignatureBoxes(signatures);
});

signaturesList.addEventListener("click", (event) => {
  const button = event.target.closest(".clear-signature-button");
  if (!button) return;
  const canvas = button.closest(".signature-card").querySelector(".signature-canvas");
  clearSignatureCanvas(canvas);
});

clearClientSignatureButton.addEventListener("click", () => {
  clearSignatureCanvas(clientSignatureCanvas);
});

function signaturePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function beginSignatureDraw(event) {
  const canvas = event.target.closest(".signature-canvas");
  if (!canvas) return;
  event.preventDefault();
  activeSignatureCanvas = canvas;
  activePointerId = event.pointerId;
  canvas.setPointerCapture?.(event.pointerId);
  const point = signaturePoint(canvas, event);
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
}

function moveSignatureDraw(event) {
  if (!activeSignatureCanvas || event.pointerId !== activePointerId) return;
  event.preventDefault();
  const point = signaturePoint(activeSignatureCanvas, event);
  const ctx = activeSignatureCanvas.getContext("2d");
  ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  activeSignatureCanvas.dataset.dirty = "true";
}

function endSignatureDraw(event) {
  if (!activeSignatureCanvas || event.pointerId !== activePointerId) return;
  activeSignatureCanvas.releasePointerCapture?.(event.pointerId);
  activeSignatureCanvas = null;
  activePointerId = null;
}

signaturesList.addEventListener("pointerdown", beginSignatureDraw);
clientSignatureCanvas.addEventListener("pointerdown", beginSignatureDraw);
document.addEventListener("pointermove", moveSignatureDraw);
document.addEventListener("pointerup", endSignatureDraw);
document.addEventListener("pointercancel", endSignatureDraw);

resetForm();
loadPartes().catch((error) => {
  setState("Error");
  alert(error.message);
});
