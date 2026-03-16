
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
let currentEquipments = [];
let currentEquipmentFindings = [];
let currentEquipmentServicePhotos = [];
let editingPhotos = [];
let signatureState = {
  drawing: false,
  hasSignature: false
};

const elements = {
  inspectionView: document.getElementById("inspectionView"),
  equipmentEditorView: document.getElementById("equipmentEditorView"),
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
  equipmentList: document.getElementById("equipmentList"),
  addEquipmentButton: document.getElementById("addEquipmentButton"),
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
  equipmentEditorTitle: document.getElementById("equipmentEditorTitle"),
  equipmentEditorForm: document.getElementById("equipmentEditorForm"),
  editingEquipmentId: document.getElementById("editingEquipmentId"),
  equipmentName: document.getElementById("equipmentName"),
  craneType: document.getElementById("craneType"),
  ratedCapacity: document.getElementById("ratedCapacity"),
  brandModel: document.getElementById("brandModel"),
  serialNumber: document.getElementById("serialNumber"),
  spanLength: document.getElementById("spanLength"),
  serviceClass: document.getElementById("serviceClass"),
  equipmentLocation: document.getElementById("equipmentLocation"),
  hoistType: document.getElementById("hoistType"),
  hoistCapacity: document.getElementById("hoistCapacity"),
  hoistBrandModel: document.getElementById("hoistBrandModel"),
  hoistSerialNumber: document.getElementById("hoistSerialNumber"),
  findingsList: document.getElementById("findingsList"),
  addFindingButton: document.getElementById("addFindingButton"),
  overallCondition: document.getElementById("overallCondition"),
  nextInspection: document.getElementById("nextInspection"),
  serviceSummary: document.getElementById("serviceSummary"),
  recommendations: document.getElementById("recommendations"),
  servicePhotoGalleryButton: document.getElementById("servicePhotoGalleryButton"),
  servicePhotoCameraButton: document.getElementById("servicePhotoCameraButton"),
  servicePhotoGalleryInput: document.getElementById("servicePhotoGalleryInput"),
  servicePhotoCameraInput: document.getElementById("servicePhotoCameraInput"),
  servicePhotoPreview: document.getElementById("servicePhotoPreview"),
  cancelEquipmentButton: document.getElementById("cancelEquipmentButton"),
  saveEquipmentButton: document.getElementById("saveEquipmentButton"),
  findingEditorTitle: document.getElementById("findingEditorTitle"),
  findingEditorForm: document.getElementById("findingEditorForm"),
  editingFindingId: document.getElementById("editingFindingId"),
  findingCategory: document.getElementById("findingCategory"),
  findingIncidence: document.getElementById("findingIncidence"),
  findingDescription: document.getElementById("findingDescription"),
  findingPhotoGalleryButton: document.getElementById("findingPhotoGalleryButton"),
  findingPhotoCameraButton: document.getElementById("findingPhotoCameraButton"),
  findingPhotoGalleryInput: document.getElementById("findingPhotoGalleryInput"),
  findingPhotoCameraInput: document.getElementById("findingPhotoCameraInput"),
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
  resetEquipmentEditorState();
  renderEquipmentList();
  await renderSavedReports();
  updateConnectivityStatus();
  registerServiceWorker();
}

function setupAppActions() {
  elements.addEquipmentButton.addEventListener("click", () => openEquipmentEditor());
  elements.cancelEquipmentButton.addEventListener("click", closeEquipmentEditor);
  elements.saveEquipmentButton.addEventListener("click", saveEquipmentFromEditor);
  elements.addFindingButton.addEventListener("click", () => openFindingEditor());
  elements.findingCategory.addEventListener("change", () => populateIncidenceOptions());
  elements.findingPhotoGalleryButton.addEventListener("click", () => elements.findingPhotoGalleryInput.click());
  elements.findingPhotoCameraButton.addEventListener("click", () => elements.findingPhotoCameraInput.click());
  elements.servicePhotoGalleryButton.addEventListener("click", () => elements.servicePhotoGalleryInput.click());
  elements.servicePhotoCameraButton.addEventListener("click", () => elements.servicePhotoCameraInput.click());
  elements.findingPhotoGalleryInput.addEventListener("change", handleFindingPhotos);
  elements.findingPhotoCameraInput.addEventListener("change", handleFindingPhotos);
  elements.servicePhotoGalleryInput.addEventListener("change", handleServicePhotos);
  elements.servicePhotoCameraInput.addEventListener("change", handleServicePhotos);
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
  const categories = Object.keys(findingCatalog);
  elements.findingCategory.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  populateIncidenceOptions();
}

function populateIncidenceOptions(selectedIncidence) {
  const category = elements.findingCategory.value || Object.keys(findingCatalog)[0];
  const incidences = findingCatalog[category] || [];
  elements.findingIncidence.innerHTML = incidences
    .map((incidence) => `<option value="${escapeHtml(incidence)}">${escapeHtml(incidence)}</option>`)
    .join("");

  if (selectedIncidence && incidences.includes(selectedIncidence)) {
    elements.findingIncidence.value = selectedIncidence;
  }
}

function openEquipmentEditor(equipmentId) {
  const equipment = currentEquipments.find((item) => item.id === equipmentId);
  const normalized = equipment ? normalizeEquipment(equipment) : createEmptyEquipment();

  elements.equipmentEditorTitle.textContent = equipment ? "Editar equipo" : "Nuevo equipo";
  elements.editingEquipmentId.value = equipment ? equipment.id : "";
  loadEquipmentIntoEditor(normalized);
  showView("equipment");
}

function loadEquipmentIntoEditor(equipment) {
  elements.equipmentEditorForm.reset();
  elements.equipmentName.value = equipment.equipmentName;
  elements.craneType.value = equipment.craneType;
  elements.ratedCapacity.value = equipment.ratedCapacity;
  elements.brandModel.value = equipment.brandModel;
  elements.serialNumber.value = equipment.serialNumber;
  elements.spanLength.value = equipment.spanLength;
  elements.serviceClass.value = equipment.serviceClass;
  elements.equipmentLocation.value = equipment.equipmentLocation;
  elements.hoistType.value = equipment.hoistType;
  elements.hoistCapacity.value = equipment.hoistCapacity;
  elements.hoistBrandModel.value = equipment.hoistBrandModel;
  elements.hoistSerialNumber.value = equipment.hoistSerialNumber;
  elements.overallCondition.value = equipment.overallCondition;
  elements.nextInspection.value = equipment.nextInspection;
  elements.serviceSummary.value = equipment.serviceSummary;
  elements.recommendations.value = equipment.recommendations;
  currentEquipmentFindings = equipment.findings.slice();
  currentEquipmentServicePhotos = equipment.servicePhotos.slice();
  renderFindingsList();
  renderServicePhotos();
}

function closeEquipmentEditor() {
  resetEquipmentEditorState();
  showView("inspection");
}

function resetEquipmentEditorState() {
  elements.equipmentEditorForm.reset();
  elements.editingEquipmentId.value = "";
  currentEquipmentFindings = [];
  currentEquipmentServicePhotos = [];
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 6);
  elements.overallCondition.value = "Bueno";
  elements.nextInspection.value = nextDate.toISOString().slice(0, 10);
  renderFindingsList();
  renderServicePhotos();
}
function openFindingEditor(findingId) {
  const categories = Object.keys(findingCatalog);
  if (!categories.length) {
    window.alert("No hay categorias de hallazgo configuradas.");
    return;
  }

  const finding = currentEquipmentFindings.find((item) => item.id === findingId);
  elements.findingEditorTitle.textContent = finding ? "Editar hallazgo" : "Nuevo hallazgo";
  elements.editingFindingId.value = finding ? finding.id : "";
  elements.findingCategory.value = finding ? finding.category : categories[0];
  populateIncidenceOptions(finding ? finding.incidence : undefined);
  elements.findingDescription.value = finding ? finding.description : "";
  editingPhotos = finding ? finding.photos.slice() : [];
  elements.findingPhotoGalleryInput.value = "";
  elements.findingPhotoCameraInput.value = "";
  renderEditingPhotos();
  showView("finding");
}

function closeFindingEditor() {
  elements.findingEditorForm.reset();
  elements.editingFindingId.value = "";
  editingPhotos = [];
  populateCategoryOptions();
  renderEditingPhotos();
  showView("equipment");
}

function showView(view) {
  elements.inspectionView.classList.toggle("hidden", view !== "inspection");
  elements.equipmentEditorView.classList.toggle("hidden", view !== "equipment");
  elements.findingEditorView.classList.toggle("hidden", view !== "finding");
}

async function handleFindingPhotos(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const encoded = await Promise.all(files.map(fileToDataUrl));
  editingPhotos = editingPhotos.concat(encoded);
  elements.findingPhotoGalleryInput.value = "";
  elements.findingPhotoCameraInput.value = "";
  renderEditingPhotos();
}

async function handleServicePhotos(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const encoded = await Promise.all(files.map(fileToDataUrl));
  currentEquipmentServicePhotos = currentEquipmentServicePhotos.concat(encoded);
  elements.servicePhotoGalleryInput.value = "";
  elements.servicePhotoCameraInput.value = "";
  renderServicePhotos();
}

function renderEditingPhotos() {
  elements.findingPhotoPreview.innerHTML = "";
  editingPhotos.forEach((photo, index) => {
    elements.findingPhotoPreview.appendChild(buildPhotoThumb(photo, () => {
      editingPhotos = editingPhotos.filter((_, photoIndex) => photoIndex !== index);
      renderEditingPhotos();
    }));
  });
}

function renderServicePhotos() {
  elements.servicePhotoPreview.innerHTML = "";
  currentEquipmentServicePhotos.forEach((photo, index) => {
    elements.servicePhotoPreview.appendChild(buildPhotoThumb(photo, () => {
      currentEquipmentServicePhotos = currentEquipmentServicePhotos.filter((_, photoIndex) => photoIndex !== index);
      renderServicePhotos();
    }));
  });
}

function buildPhotoThumb(photo, onRemove) {
  const wrapper = document.createElement("div");
  wrapper.className = "photo-thumb";
  const img = document.createElement("img");
  img.src = photo;
  img.alt = "Evidencia fotografica";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "photo-remove";
  removeButton.textContent = "x";
  removeButton.addEventListener("click", onRemove);
  wrapper.appendChild(img);
  wrapper.appendChild(removeButton);
  return wrapper;
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

  const existingIndex = currentEquipmentFindings.findIndex((item) => item.id === findingId);
  if (existingIndex >= 0) {
    currentEquipmentFindings[existingIndex] = finding;
  } else {
    currentEquipmentFindings.push(finding);
  }

  renderFindingsList();
  closeFindingEditor();
}

function renderFindingsList() {
  elements.findingsList.innerHTML = "";

  if (!currentEquipmentFindings.length) {
    elements.findingsList.innerHTML = '<div class="inline-empty-state">Todavia no hay hallazgos capturados para este equipo. Usa el boton de Anadir Hallazgo para registrar uno.</div>';
    return;
  }

  currentEquipmentFindings.forEach((finding, index) => {
    const shell = document.createElement("div");
    shell.className = "list-card-shell";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "finding-list-card";
    card.innerHTML = `
      <p><strong>Hallazgo ${index + 1}: ${escapeHtml(finding.category)}</strong></p>
      <div class="finding-meta">
        <span>${escapeHtml(finding.incidence)}</span>
        <span>${(finding.photos || []).length} foto(s)</span>
      </div>
      <p>${escapeHtml(truncateText(finding.description, 140))}</p>
    `;
    card.addEventListener("click", () => openFindingEditor(finding.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteFinding(finding.id);
    });

    shell.appendChild(card);
    shell.appendChild(deleteButton);
    elements.findingsList.appendChild(shell);
  });
}

function saveEquipmentFromEditor() {
  if (!elements.equipmentEditorForm.reportValidity()) {
    elements.equipmentEditorForm.reportValidity();
    return;
  }

  const equipmentId = elements.editingEquipmentId.value || createId();
  const equipment = normalizeEquipment({
    id: equipmentId,
    equipmentName: elements.equipmentName.value.trim(),
    craneType: elements.craneType.value,
    ratedCapacity: elements.ratedCapacity.value.trim(),
    brandModel: elements.brandModel.value.trim(),
    serialNumber: elements.serialNumber.value.trim(),
    spanLength: elements.spanLength.value.trim(),
    serviceClass: elements.serviceClass.value.trim(),
    equipmentLocation: elements.equipmentLocation.value.trim(),
    hoistType: elements.hoistType.value.trim(),
    hoistCapacity: elements.hoistCapacity.value.trim(),
    hoistBrandModel: elements.hoistBrandModel.value.trim(),
    hoistSerialNumber: elements.hoistSerialNumber.value.trim(),
    findings: currentEquipmentFindings.slice(),
    overallCondition: elements.overallCondition.value,
    nextInspection: elements.nextInspection.value,
    serviceSummary: elements.serviceSummary.value.trim(),
    recommendations: elements.recommendations.value.trim(),
    servicePhotos: currentEquipmentServicePhotos.slice(),
    updatedAt: new Date().toISOString()
  });

  const existingIndex = currentEquipments.findIndex((item) => item.id === equipmentId);
  if (existingIndex >= 0) {
    currentEquipments[existingIndex] = equipment;
  } else {
    currentEquipments.push(equipment);
  }

  renderEquipmentList();
  closeEquipmentEditor();
}

function renderEquipmentList() {
  elements.equipmentList.innerHTML = "";

  if (!currentEquipments.length) {
    elements.equipmentList.innerHTML = '<div class="inline-empty-state">Todavia no hay equipos en este reporte. Usa el boton de Anadir Equipo para registrar el primero.</div>';
    return;
  }

  currentEquipments.forEach((equipment, index) => {
    const normalized = normalizeEquipment(equipment);
    const shell = document.createElement("div");
    shell.className = "list-card-shell";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "finding-list-card";
    card.innerHTML = `
      <p><strong>Equipo ${index + 1}: ${escapeHtml(normalized.equipmentName || normalized.craneType || "Equipo sin nombre")}</strong></p>
      <div class="finding-meta">
        <span>${escapeHtml(normalized.craneType || "Tipo no capturado")}</span>
        <span>${normalized.findings.length} hallazgo(s)</span>
        <span>${normalized.servicePhotos.length} evidencia(s)</span>
      </div>
      <p>${escapeHtml(buildEquipmentCardSummary(normalized))}</p>
    `;
    card.addEventListener("click", () => openEquipmentEditor(normalized.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteEquipment(normalized.id);
    });

    shell.appendChild(card);
    shell.appendChild(deleteButton);
    elements.equipmentList.appendChild(shell);
  });
}

function deleteFinding(findingId) {
  currentEquipmentFindings = currentEquipmentFindings.filter((item) => item.id !== findingId);
  renderFindingsList();
}

function deleteEquipment(equipmentId) {
  currentEquipments = currentEquipments.filter((item) => item.id !== equipmentId);
  renderEquipmentList();
}

function buildEquipmentCardSummary(equipment) {
  const pieces = [
    equipment.brandModel,
    equipment.serialNumber ? `Serie ${equipment.serialNumber}` : "",
    equipment.overallCondition
  ].filter(Boolean);
  return pieces.length ? pieces.join(" | ") : "Sin detalle adicional capturado.";
}

function setDefaultDates() {
  const today = new Date();
  elements.inspectionDate.value = today.toISOString().slice(0, 10);
}

function assignNewReportNumber(force) {
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
    equipments: currentEquipments.map((equipment) => normalizeEquipment(equipment)),
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

  if (!currentEquipments.length) {
    window.alert("Agrega al menos un equipo antes de guardar o generar el reporte.");
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

  popup.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Generando reporte PDF...</p>');
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
    .map(normalizeInspection)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((record) => {
      const card = document.createElement("article");
      card.className = "saved-card";
      card.innerHTML = `
        <p><strong>${escapeHtml(record.plantName || "Cliente sin nombre")}</strong></p>
        <p>${escapeHtml(record.reportNumber)} | ${escapeHtml(record.inspectionDate || "")}</p>
        <p>${escapeHtml(record.serviceType || "Servicio")} | ${record.equipments.length} equipo(s)</p>
        <div class="saved-actions">
          <button class="secondary-button" type="button" data-open-id="${record.id}">Abrir</button>
          <button class="ghost-button" type="button" data-delete-id="${record.id}">Eliminar</button>
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
  resetEquipmentEditorState();
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
  elements.receiverName.value = normalized.receiverName || "";
  currentEquipments = normalized.equipments.map((equipment) => normalizeEquipment(equipment));
  renderEquipmentList();

  if (normalized.signatureDataUrl) {
    drawSignatureImage(normalized.signatureDataUrl);
  } else {
    clearSignature();
  }

  showView("inspection");
}

function resetForm() {
  elements.form.reset();
  elements.inspectionId.value = "";
  currentEquipments = [];
  clearSignature();
  setDefaultDates();
  assignNewReportNumber(true);
  elements.serviceType.value = "Inspeccion de grua";
  resetEquipmentEditorState();
  renderEquipmentList();
  showView("inspection");
}

function normalizeInspection(record) {
  const source = record || {};
  const equipments = Array.isArray(source.equipments) && source.equipments.length
    ? source.equipments.map((equipment) => normalizeEquipment(equipment))
    : source.craneType || source.findings || source.recommendations
      ? [normalizeEquipment(createLegacyEquipment(source))]
      : [];

  return {
    ...source,
    reportNumber: source.reportNumber || createReportNumber(source.inspectionDate, source.id),
    serviceType: source.serviceType || "Inspeccion de grua",
    equipments
  };
}

function createLegacyEquipment(record) {
  return {
    id: createId(),
    equipmentName: record.craneType ? `Equipo ${record.craneType}` : "Equipo 1",
    craneType: record.craneType || "Puente",
    ratedCapacity: record.ratedCapacity || "",
    brandModel: record.brandModel || "",
    serialNumber: record.serialNumber || "",
    spanLength: record.spanLength || "",
    serviceClass: record.serviceClass || "",
    equipmentLocation: "",
    hoistType: "",
    hoistCapacity: "",
    hoistBrandModel: "",
    hoistSerialNumber: "",
    findings: Array.isArray(record.findings) ? record.findings : [],
    overallCondition: record.overallCondition || "Bueno",
    nextInspection: record.nextInspection || "",
    serviceSummary: "",
    recommendations: record.recommendations || "",
    servicePhotos: []
  };
}

function createEmptyEquipment() {
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 6);
  return normalizeEquipment({
    id: "",
    equipmentName: "",
    craneType: "Puente",
    ratedCapacity: "",
    brandModel: "",
    serialNumber: "",
    spanLength: "",
    serviceClass: "",
    equipmentLocation: "",
    hoistType: "",
    hoistCapacity: "",
    hoistBrandModel: "",
    hoistSerialNumber: "",
    findings: [],
    overallCondition: "Bueno",
    nextInspection: nextDate.toISOString().slice(0, 10),
    serviceSummary: "",
    recommendations: "",
    servicePhotos: []
  });
}

function normalizeEquipment(equipment) {
  const source = equipment || {};
  return {
    ...source,
    id: source.id || createId(),
    equipmentName: source.equipmentName || "",
    craneType: source.craneType || "Puente",
    ratedCapacity: source.ratedCapacity || "",
    brandModel: source.brandModel || "",
    serialNumber: source.serialNumber || "",
    spanLength: source.spanLength || "",
    serviceClass: source.serviceClass || "",
    equipmentLocation: source.equipmentLocation || "",
    hoistType: source.hoistType || "",
    hoistCapacity: source.hoistCapacity || "",
    hoistBrandModel: source.hoistBrandModel || "",
    hoistSerialNumber: source.hoistSerialNumber || "",
    findings: Array.isArray(source.findings) ? source.findings : [],
    overallCondition: source.overallCondition || "Bueno",
    nextInspection: source.nextInspection || "",
    serviceSummary: source.serviceSummary || "",
    recommendations: source.recommendations || "",
    servicePhotos: Array.isArray(source.servicePhotos) ? source.servicePhotos : []
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
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
