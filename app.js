function sanitizeFindingCatalog(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const normalized = Object.entries(source)
    .map(([category, incidences]) => ({
      category: String(category || "").trim(),
      incidences: Array.isArray(incidences)
        ? incidences.map((item) => String(item || "").trim()).filter(Boolean)
        : []
    }))
    .filter((item) => item.category && item.incidences.length);

  if (!normalized.length) {
    return null;
  }

  return Object.fromEntries(normalized.map((item) => [item.category, item.incidences]));
}
const DB_NAME = "crane-inspections-db";
const DB_VERSION = 1;
const STORE_NAME = "inspections";

const fallbackFindingCatalog = {
  "General": ["Hallazgo general"]
};

const findingCatalog = sanitizeFindingCatalog(window.FINDING_CATALOG_CONFIG) || fallbackFindingCatalog;

let deferredInstallPrompt = null;
let currentFindings = [];
let editingPhotos = [];
let signatureState = {
  drawing: false,
  hasSignature: false
};

const elements = {
  inspectionView: document.getElementById("inspectionView"),
  findingEditorView: document.getElementById("findingEditorView"),
  form: document.getElementById("inspectionForm"),
  inspectionId: document.getElementById("inspectionId"),
  reportNumber: document.getElementById("reportNumber"),
  serviceType: document.getElementById("serviceType"),
  inspectionDate: document.getElementById("inspectionDate"),
  technicianName: document.getElementById("technicianName"),
  plantName: document.getElementById("plantName"),
  plantLocation: document.getElementById("plantLocation"),
  siteContact: document.getElementById("siteContact"),
  siteContactInfo: document.getElementById("siteContactInfo"),
  craneType: document.getElementById("craneType"),
  ratedCapacity: document.getElementById("ratedCapacity"),
  brandModel: document.getElementById("brandModel"),
  serialNumber: document.getElementById("serialNumber"),
  spanLength: document.getElementById("spanLength"),
  serviceClass: document.getElementById("serviceClass"),
  findingsList: document.getElementById("findingsList"),
  addFindingButton: document.getElementById("addFindingButton"),
  overallCondition: document.getElementById("overallCondition"),
  nextInspection: document.getElementById("nextInspection"),
  recommendations: document.getElementById("recommendations"),
  receiverName: document.getElementById("receiverName"),
  signaturePad: document.getElementById("signaturePad"),
  clearSignatureButton: document.getElementById("clearSignatureButton"),
  saveInspectionButton: document.getElementById("saveInspectionButton"),
  generatePdfButton: document.getElementById("generatePdfButton"),
  newInspectionButton: document.getElementById("newInspectionButton"),
  savedReports: document.getElementById("savedReports"),
  refreshReportsButton: document.getElementById("refreshReportsButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  installButton: document.getElementById("installButton"),
  findingEditorTitle: document.getElementById("findingEditorTitle"),
  findingEditorForm: document.getElementById("findingEditorForm"),
  editingFindingId: document.getElementById("editingFindingId"),
  findingCategory: document.getElementById("findingCategory"),
  findingIncidence: document.getElementById("findingIncidence"),
  findingDescription: document.getElementById("findingDescription"),
  findingPhotoInput: document.getElementById("findingPhotoInput"),
  findingPhotoPreview: document.getElementById("findingPhotoPreview"),
  cancelFindingButton: document.getElementById("cancelFindingButton"),
  saveFindingButton: document.getElementById("saveFindingButton")
};

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  populateCategoryOptions();
  setupSignaturePad();
  setupAppActions();
  setDefaultDates();
  assignNewReportNumber(true);
  renderFindingsList();
  await renderSavedReports();
  updateConnectivityStatus();
  registerServiceWorker();
}

function setupAppActions() {
  elements.addFindingButton.addEventListener("click", () => openFindingEditor());
  elements.findingCategory.addEventListener("change", () => populateIncidenceOptions());
  elements.findingPhotoInput.addEventListener("change", handleFindingPhotos);
  elements.cancelFindingButton.addEventListener("click", closeFindingEditor);
  elements.saveFindingButton.addEventListener("click", saveFindingFromEditor);
  elements.clearSignatureButton.addEventListener("click", clearSignature);
  elements.saveInspectionButton.addEventListener("click", async () => {
    await persistInspection();
  });
  elements.generatePdfButton.addEventListener("click", generatePdfReport);
  elements.newInspectionButton.addEventListener("click", resetForm);
  elements.refreshReportsButton.addEventListener("click", renderSavedReports);

  window.addEventListener("online", updateConnectivityStatus);
  window.addEventListener("offline", updateConnectivityStatus);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }
    await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });
}

function populateCategoryOptions() {
  elements.findingCategory.innerHTML = Object.keys(findingCatalog)
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");
  populateIncidenceOptions();
}

function populateIncidenceOptions(selectedIncidence) {
  const category = elements.findingCategory.value || Object.keys(findingCatalog)[0];
  const incidences = findingCatalog[category] || [];
  elements.findingIncidence.innerHTML = incidences
    .map((incidence) => `<option value="${incidence}">${incidence}</option>`)
    .join("");

  if (selectedIncidence && incidences.indexOf(selectedIncidence) >= 0) {
    elements.findingIncidence.value = selectedIncidence;
  }
}

function openFindingEditor(findingId) {
  const finding = currentFindings.find((item) => item.id === findingId);
  elements.findingEditorTitle.textContent = finding ? "Editar hallazgo" : "Nuevo hallazgo";
  elements.editingFindingId.value = finding ? finding.id : "";
  elements.findingCategory.value = finding ? finding.category : Object.keys(findingCatalog)[0];
  populateIncidenceOptions(finding ? finding.incidence : undefined);
  elements.findingDescription.value = finding ? finding.description : "";
  editingPhotos = finding ? finding.photos.slice() : [];
  elements.findingPhotoInput.value = "";
  renderEditingPhotos();
  showView("finding");
}

function closeFindingEditor() {
  elements.findingEditorForm.reset();
  elements.editingFindingId.value = "";
  editingPhotos = [];
  populateCategoryOptions();
  renderEditingPhotos();
  showView("inspection");
}

function showView(view) {
  const showFinding = view === "finding";
  elements.inspectionView.classList.toggle("hidden", showFinding);
  elements.findingEditorView.classList.toggle("hidden", !showFinding);
}

async function handleFindingPhotos(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const encoded = await Promise.all(files.map(fileToDataUrl));
  editingPhotos = editingPhotos.concat(encoded);
  elements.findingPhotoInput.value = "";
  renderEditingPhotos();
}

function renderEditingPhotos() {
  elements.findingPhotoPreview.innerHTML = "";

  editingPhotos.forEach((photo, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "Evidencia del hallazgo";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "photo-remove";
    removeButton.textContent = "x";
    removeButton.addEventListener("click", () => {
      editingPhotos = editingPhotos.filter((_, photoIndex) => photoIndex !== index);
      renderEditingPhotos();
    });
    wrapper.appendChild(img);
    wrapper.appendChild(removeButton);
    elements.findingPhotoPreview.appendChild(wrapper);
  });
}

function saveFindingFromEditor() {
  if (!elements.findingEditorForm.reportValidity()) {
    elements.findingEditorForm.reportValidity();
    return;
  }

  const findingId = elements.editingFindingId.value || createId();
  const finding = {
    id: findingId,
    category: elements.findingCategory.value,
    incidence: elements.findingIncidence.value,
    description: elements.findingDescription.value.trim(),
    photos: editingPhotos.slice(),
    updatedAt: new Date().toISOString()
  };

  const existingIndex = currentFindings.findIndex((item) => item.id === findingId);
  if (existingIndex >= 0) {
    currentFindings[existingIndex] = finding;
  } else {
    currentFindings.push(finding);
  }

  renderFindingsList();
  closeFindingEditor();
}

function renderFindingsList() {
  elements.findingsList.innerHTML = "";

  if (!currentFindings.length) {
    elements.findingsList.innerHTML = '<div class="inline-empty-state">Todavia no hay hallazgos capturados. Usa el boton de Anadir Hallazgo para registrar uno.</div>';
    return;
  }

  currentFindings.forEach((finding, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "finding-list-card";
    card.innerHTML = `
      <p><strong>Hallazgo ${index + 1}: ${escapeHtml(finding.category)}</strong></p>
      <div class="finding-meta">
        <span>${escapeHtml(finding.incidence)}</span>
        <span>${finding.photos.length} foto(s)</span>
      </div>
      <p>${escapeHtml(truncateText(finding.description, 140))}</p>
    `;
    card.addEventListener("click", () => openFindingEditor(finding.id));
    elements.findingsList.appendChild(card);
  });
}

function setDefaultDates() {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  elements.inspectionDate.value = isoDate;

  const nextDate = new Date(today);
  nextDate.setMonth(nextDate.getMonth() + 6);
  elements.nextInspection.value = nextDate.toISOString().slice(0, 10);
}

function assignNewReportNumber(force = false) {
  if (!force && elements.reportNumber.value.trim()) {
    return;
  }
  elements.reportNumber.value = createReportNumber();
}

function updateConnectivityStatus() {
  elements.connectionStatus.textContent = navigator.onLine
    ? "Con conexion. Los datos siguen guardandose localmente."
    : "Sin conexion. Puedes seguir trabajando offline.";
}

function collectInspectionData() {
  return {
    id: elements.inspectionId.value || createId(),
    reportNumber: elements.reportNumber.value.trim() || createReportNumber(elements.inspectionDate.value, elements.inspectionId.value),
    serviceType: elements.serviceType.value,
    inspectionDate: elements.inspectionDate.value,
    technicianName: elements.technicianName.value.trim(),
    plantName: elements.plantName.value.trim(),
    plantLocation: elements.plantLocation.value.trim(),
    siteContact: elements.siteContact.value.trim(),
    siteContactInfo: elements.siteContactInfo.value.trim(),
    craneType: elements.craneType.value,
    ratedCapacity: elements.ratedCapacity.value.trim(),
    brandModel: elements.brandModel.value.trim(),
    serialNumber: elements.serialNumber.value.trim(),
    spanLength: elements.spanLength.value.trim(),
    serviceClass: elements.serviceClass.value.trim(),
    findings: currentFindings,
    overallCondition: elements.overallCondition.value,
    nextInspection: elements.nextInspection.value,
    recommendations: elements.recommendations.value.trim(),
    receiverName: elements.receiverName.value.trim(),
    signatureDataUrl: signatureState.hasSignature ? elements.signaturePad.toDataURL("image/png") : "",
    updatedAt: new Date().toISOString()
  };
}

async function persistInspection() {
  if (!elements.form.reportValidity()) {
    elements.form.reportValidity();
    return null;
  }

  const inspection = collectInspectionData();
  elements.inspectionId.value = inspection.id;
  elements.reportNumber.value = inspection.reportNumber;
  await putInspection(inspection);
  await renderSavedReports();
  return inspection;
}

async function generatePdfReport() {
  const popup = window.open("", "_blank");
  if (!popup) {
    window.alert("No se pudo abrir la vista PDF. Revisa si el navegador bloqueo la ventana emergente.");
    return;
  }

  popup.document.write("<p style=\"font-family: Arial, sans-serif; padding: 24px;\">Generando reporte PDF...</p>");
  popup.document.close();

  const inspection = await persistInspection();
  if (!inspection) {
    popup.close();
    return;
  }
  openReportPdfWindow(inspection, popup);
}

async function renderSavedReports() {
  const records = await getAllInspections();
  elements.savedReports.innerHTML = "";

  if (!records.length) {
    elements.savedReports.innerHTML = '<div class="empty-state">Todavia no hay reportes guardados en este dispositivo.</div>';
    return;
  }

  records
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((record) => {
      const normalized = normalizeInspection(record);
      const card = document.createElement("article");
      card.className = "saved-card";
      card.innerHTML = `
        <p><strong>${escapeHtml(normalized.plantName || "Cliente sin nombre")}</strong></p>
        <p>${escapeHtml(normalized.reportNumber)} | ${escapeHtml(normalized.inspectionDate || "")}</p>
        <p>${escapeHtml(normalized.serviceType || "Servicio")} | ${escapeHtml(normalized.overallCondition || "Pendiente")}</p>
        <div class="saved-actions">
          <button class="secondary-button" type="button" data-open-id="${normalized.id}">Abrir</button>
          <button class="ghost-button" type="button" data-delete-id="${normalized.id}">Eliminar</button>
        </div>
      `;
      elements.savedReports.appendChild(card);
    });

  elements.savedReports.querySelectorAll("[data-open-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = await getInspection(button.dataset.openId);
      if (record) {
        loadInspection(normalizeInspection(record));
      }
    });
  });

  elements.savedReports.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteInspection(button.dataset.deleteId);
      if (elements.inspectionId.value === button.dataset.deleteId) {
        resetForm();
      }
      await renderSavedReports();
    });
  });
}

function loadInspection(record) {
  const normalized = normalizeInspection(record);
  closeFindingEditor();
  elements.form.reset();

  elements.inspectionId.value = normalized.id || "";
  elements.reportNumber.value = normalized.reportNumber;
  elements.serviceType.value = normalized.serviceType || "Inspeccion de grua";
  elements.inspectionDate.value = normalized.inspectionDate || "";
  elements.technicianName.value = normalized.technicianName || "";
  elements.plantName.value = normalized.plantName || "";
  elements.plantLocation.value = normalized.plantLocation || "";
  elements.siteContact.value = normalized.siteContact || "";
  elements.siteContactInfo.value = normalized.siteContactInfo || "";
  elements.craneType.value = normalized.craneType || "Puente";
  elements.ratedCapacity.value = normalized.ratedCapacity || "";
  elements.brandModel.value = normalized.brandModel || "";
  elements.serialNumber.value = normalized.serialNumber || "";
  elements.spanLength.value = normalized.spanLength || "";
  elements.serviceClass.value = normalized.serviceClass || "";
  elements.overallCondition.value = normalized.overallCondition || "Aprobada";
  elements.nextInspection.value = normalized.nextInspection || "";
  elements.recommendations.value = normalized.recommendations || "";
  elements.receiverName.value = normalized.receiverName || "";`r`ncurrentFindings = Array.isArray(normalized.findings) ? normalized.findings : [];
  renderFindingsList();

  if (normalized.signatureDataUrl) {
    drawSignatureImage(normalized.signatureDataUrl);
  } else {
    clearSignature();
  }
}

function resetForm() {
  closeFindingEditor();
  elements.form.reset();
  elements.inspectionId.value = "";
  currentFindings = [];
  clearSignature();`r`nsetDefaultDates();
  assignNewReportNumber(true);
  elements.serviceType.value = "Inspeccion de grua";
  renderFindingsList();
}

function normalizeInspection(record) {
  return {
    ...record,
    reportNumber: record.reportNumber || createReportNumber(record.inspectionDate, record.id),
    serviceType: record.serviceType || "Inspeccion de grua",
    findings: Array.isArray(record.findings) ? record.findings : []
  };
}

function setupSignaturePad() {
  const canvas = elements.signaturePad;
  const context = canvas.getContext("2d");

  const resizeCanvas = () => {
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(220 * ratio);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = "#1f2a2e";
    if (signatureState.hasSignature && canvas.dataset.snapshot) {
      drawSignatureImage(canvas.dataset.snapshot);
    }
  };

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches && event.touches[0] ? event.touches[0] : event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  };

  const start = (event) => {
    signatureState.drawing = true;
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.preventDefault();
  };

  const move = (event) => {
    if (!signatureState.drawing) {
      return;
    }
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    signatureState.hasSignature = true;
    canvas.dataset.snapshot = canvas.toDataURL("image/png");
    event.preventDefault();
  };

  const stop = () => {
    signatureState.drawing = false;
  };

  ["mousedown", "touchstart"].forEach((eventName) => {
    canvas.addEventListener(eventName, start, { passive: false });
  });
  ["mousemove", "touchmove"].forEach((eventName) => {
    canvas.addEventListener(eventName, move, { passive: false });
  });
  ["mouseup", "mouseleave", "touchend"].forEach((eventName) => {
    canvas.addEventListener(eventName, stop);
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
}

function clearSignature() {
  const canvas = elements.signaturePad;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  signatureState.hasSignature = false;
  canvas.dataset.snapshot = "";
}

function drawSignatureImage(dataUrl) {
  const canvas = elements.signaturePad;
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width / ratio, canvas.height / ratio);
    signatureState.hasSignature = true;
    canvas.dataset.snapshot = dataUrl;
  };
  image.src = dataUrl;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function putInspection(record) {
  return withStore("readwrite", (store) => store.put(record));
}

async function getInspection(id) {
  return withStore("readonly", (store) => store.get(id));
}

async function getAllInspections() {
  return withStore("readonly", (store) => store.getAll());
}

async function deleteInspection(id) {
  return withStore("readwrite", (store) => store.delete(id));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      elements.connectionStatus.textContent = "La app funciona localmente, pero el cache offline no pudo registrarse.";
    });
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "insp-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

function createReportNumber(dateValue, recordId) {
  const sourceDate = dateValue ? new Date(dateValue) : new Date();
  const year = String(sourceDate.getFullYear()).slice(-2);
  const month = String(sourceDate.getMonth() + 1).padStart(2, "0");
  const suffixSource = recordId || createId();
  const suffix = suffixSource.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "0");
  return `${year}-${month}${suffix}`;
}

function truncateText(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }
  return value.slice(0, maxLength - 1) + "...";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}












