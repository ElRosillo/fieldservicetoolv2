const DEFAULT_TEMPLATE_CONFIG = {
  companyName: "FMC Industrial",
  companySubtitle: "Servicio tecnico especializado",
  logoMode: "image",
  logoText: "FMC",
  logoImageUrl: "logo.png",
  reportTitle: "REPORTE DE SERVICIO",
  reportRevision: "01",
  footerLegend: "Documento generado automaticamente desde la app de inspecciones.",
  accentColor: "#f28c28",
  headerColor: "#1f1f1f"
};

const REPORT_STYLE = `
  @page {
    size: Letter;
    margin: 10mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    background: #dfe4e7;
  }

  .report-shell {
    width: 216mm;
    margin: 0 auto;
    padding: 6mm 0 16mm;
    counter-reset: page;
  }

  .page {
    position: relative;
    width: 100%;
    min-height: 277mm;
    padding: 0;
    margin-bottom: 6mm;
    background: #fff;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    page-break-after: always;
    counter-increment: page;
  }

  .page:last-child {
    page-break-after: auto;
  }

  .page-inner {
    padding: 8mm;
  }

  .header-table,
  .meta-table,
  .summary-table,
  .findings-table,
  .equipment-table,
  .signatures-table,
  .evidence-table {
    width: 100%;
    border-collapse: collapse;
  }

  .header-table td,
  .meta-table td,
  .summary-table td,
  .findings-table td,
  .findings-table th,
  .equipment-table td,
  .equipment-table th,
  .signatures-table td,
  .evidence-table td {
    border: 1px solid var(--header-color);
    padding: 2.2mm 2.4mm;
    vertical-align: top;
    font-size: 9pt;
  }

  .header-table {
    table-layout: fixed;
  }

  .header-brand {
    width: 34mm;
    text-align: center;
    font-weight: 700;
    background: #f4f4f4;
  }

  .brand-mark {
    display: inline-flex;
    width: 22mm;
    height: 22mm;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--accent-color);
    color: var(--accent-color);
    font-size: 14pt;
    font-weight: 700;
    margin-bottom: 2mm;
    overflow: hidden;
    background: white;
  }

  .brand-mark img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .header-title {
    text-align: center;
    font-size: 15pt;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .header-subtitle {
    display: block;
    margin-top: 1mm;
    font-size: 9pt;
    font-weight: 400;
  }

  .header-code {
    width: 44mm;
    padding: 0;
  }

  .mini-table {
    width: 100%;
    border-collapse: collapse;
  }

  .mini-table td {
    border: 1px solid var(--header-color);
    padding: 1.7mm 2mm;
    font-size: 8pt;
  }

  .label {
    font-size: 7.4pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #2b2b2b;
    letter-spacing: 0.03em;
  }

  .value {
    font-size: 9pt;
    line-height: 1.35;
    white-space: pre-wrap;
  }

  .section-banner {
    margin-top: 4mm;
    margin-bottom: 0;
    padding: 2mm 3mm;
    background: #d9d9d9;
    border: 1px solid var(--header-color);
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
  }

  .summary-table td,
  .equipment-table td,
  .equipment-table th,
  .findings-table td,
  .findings-table th,
  .signatures-table td,
  .evidence-table td,
  .meta-table td {
    font-size: 8.7pt;
  }

  .findings-table th,
  .equipment-table th {
    background: #efefef;
    text-transform: uppercase;
    font-size: 7.8pt;
    letter-spacing: 0.03em;
    text-align: left;
  }

  .notes-box {
    min-height: 28mm;
  }

  .signature-space {
    min-height: 34mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }

  .signature-space img {
    max-width: 100%;
    max-height: 30mm;
    object-fit: contain;
  }

  .evidence-photo {
    width: 100%;
    height: 62mm;
    object-fit: contain;
    display: block;
    background: #fff;
  }

  .muted {
    color: #666;
    font-style: italic;
  }

  .footer {
    position: absolute;
    bottom: 5mm;
    left: 8mm;
    right: 8mm;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #444;
  }

  .page-number::after {
    content: counter(page);
  }

  @media print {
    body {
      background: white;
    }

    .report-shell {
      width: auto;
      padding: 0;
    }

    .page {
      margin: 0;
      box-shadow: none;
    }
  }
`;

function openReportPdfWindow(inspection, existingPopup) {
  const reportData = buildReportData(inspection);
  const popup = existingPopup || window.open("", "_blank");

  if (!popup) {
    window.alert("No se pudo abrir la vista del PDF. Revisa si el navegador bloqueo la ventana emergente.");
    return false;
  }

  popup.focus();
  popup.document.open();
  popup.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(reportData.reportNumber)} - Reporte de Servicio</title>
  <style>:root { --accent-color: ${escapeHtml(reportData.template.accentColor)}; --header-color: ${escapeHtml(reportData.template.headerColor)}; } ${REPORT_STYLE}</style>
</head>
<body>
  <div class="report-shell">
    ${renderMainReportPage(reportData)}
    ${renderEvidencePages(reportData)}
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 250);
    });
  <\/script>
</body>
</html>`);
  popup.document.close();
  return true;
}

function buildReportData(inspection) {
  const findings = Array.isArray(inspection.findings) ? inspection.findings : [];
  const totalPhotos = findings.reduce((sum, finding) => sum + (finding.photos || []).length, 0);
  const recommendations = inspection.recommendations && inspection.recommendations.trim()
    ? inspection.recommendations.trim()
    : buildAutomaticRecommendations(findings, inspection.overallCondition);
  const template = getTemplateConfig();

  return {
    ...inspection,
    findings,
    totalPhotos,
    recommendations,
    template,
    inspectionDateLabel: formatDate(inspection.inspectionDate),
    nextInspectionLabel: formatDate(inspection.nextInspection),
    issuedAtLabel: formatDateTime(inspection.updatedAt || new Date().toISOString()),
    summaryText: buildExecutiveSummary({ ...inspection, findings, totalPhotos })
  };
}

function getTemplateConfig() {
  const custom = window.REPORT_TEMPLATE_CONFIG || {};
  const merged = { ...DEFAULT_TEMPLATE_CONFIG, ...custom };
  if (merged.logoImageUrl) {
    try {
      merged.logoImageUrl = new URL(merged.logoImageUrl, window.location.href).href;
    } catch (error) {
      merged.logoImageUrl = custom.logoImageUrl || "";
    }
  }
  return merged;
}

function renderMainReportPage(report) {
  return `
    <section class="page">
      <div class="page-inner">
        ${renderHeader(report)}

        <div class="section-banner">Datos generales del servicio</div>
        <table class="meta-table">
          <tr>
            <td><div class="label">Cliente / Planta</div><div class="value">${escapeHtml(report.plantName || "No capturado")}</div></td>
            <td><div class="label">Ubicacion</div><div class="value">${escapeHtml(report.plantLocation || "No capturado")}</div></td>
          </tr>
          <tr>
            <td><div class="label">Tecnico responsable</div><div class="value">${escapeHtml(report.technicianName || "No capturado")}</div></td>
            <td><div class="label">Responsable en sitio</div><div class="value">${escapeHtml(report.siteContact || report.receiverName || "No capturado")}</div></td>
          </tr>
          <tr>
            <td><div class="label">Contacto</div><div class="value">${escapeHtml(report.siteContactInfo || "No capturado")}</div></td>
            <td><div class="label">Tipo de servicio</div><div class="value">${escapeHtml(report.serviceType || "No capturado")}</div></td>
          </tr>
        </table>

        <div class="section-banner">Datos del equipo</div>
        <table class="equipment-table">
          <tr>
            <th>Tipo de grua</th>
            <th>Capacidad nominal</th>
            <th>Marca / Modelo</th>
          </tr>
          <tr>
            <td>${escapeHtml(report.craneType || "No capturado")}</td>
            <td>${escapeHtml(report.ratedCapacity || "No capturado")}</td>
            <td>${escapeHtml(report.brandModel || "No capturado")}</td>
          </tr>
          <tr>
            <th>Serie / Identificacion</th>
            <th>Claro / Longitud</th>
            <th>Servicio / Clase</th>
          </tr>
          <tr>
            <td>${escapeHtml(report.serialNumber || "No capturado")}</td>
            <td>${escapeHtml(report.spanLength || "No capturado")}</td>
            <td>${escapeHtml(report.serviceClass || "No capturado")}</td>
          </tr>
        </table>

        <div class="section-banner">Resumen del servicio</div>
        <table class="summary-table">
          <tr>
            <td><div class="label">Condicion general</div><div class="value">${escapeHtml(report.overallCondition || "Pendiente")}</div></td>
            <td><div class="label">Total de hallazgos</div><div class="value">${report.findings.length}</div></td>
            <td><div class="label">Total de evidencias</div><div class="value">${report.totalPhotos}</div></td>
            <td><div class="label">Proxima inspeccion</div><div class="value">${escapeHtml(report.nextInspectionLabel || "No especificada")}</div></td>
          </tr>
          <tr>
            <td colspan="4" class="notes-box"><div class="label">Descripcion general del servicio</div><div class="value">${escapeHtml(report.summaryText)}</div></td>
          </tr>
          <tr>
            <td colspan="4" class="notes-box"><div class="label">Recomendaciones</div><div class="value">${escapeHtml(report.recommendations || "Sin recomendaciones registradas.")}</div></td>
          </tr>
        </table>

        <div class="section-banner">Hallazgos detectados</div>
        ${renderFindingsTable(report)}

        <div class="section-banner">Validacion del cliente</div>
        <table class="signatures-table">
          <tr>
            <td width="45%"><div class="label">Nombre de quien recibe</div><div class="value">${escapeHtml(report.receiverName || report.siteContact || "No capturado")}</div></td>
            <td width="30%"><div class="label">Firma</div><div class="signature-space">${report.signatureDataUrl ? `<img src="${report.signatureDataUrl}" alt="Firma del cliente">` : `<span class="muted">Sin firma capturada</span>`}</div></td>
            <td width="25%"><div class="label">Fecha de liberacion</div><div class="value">${escapeHtml(report.inspectionDateLabel || "No capturada")}</div></td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <span>${escapeHtml(report.template.footerLegend)}</span>
        <span>Pagina <span class="page-number"></span></span>
      </div>
    </section>
  `;
}

function renderHeader(report) {
  return `
    <table class="header-table">
      <tr>
        <td class="header-brand">
          <div class="brand-mark">${renderLogo(report.template)}</div>
          <div class="label">${escapeHtml(report.template.companySubtitle)}</div>
        </td>
        <td class="header-title">
          ${escapeHtml(report.template.reportTitle)}
          <span class="header-subtitle">${escapeHtml((report.serviceType || "INSPECCION DE GRUA").toUpperCase())}</span>
          <span class="header-subtitle">${escapeHtml(report.template.companyName)}</span>
        </td>
        <td class="header-code">
          <table class="mini-table">
            <tr>
              <td class="label">Folio</td>
              <td class="value">${escapeHtml(report.reportNumber || "Sin folio")}</td>
            </tr>
            <tr>
              <td class="label">Fecha</td>
              <td class="value">${escapeHtml(report.inspectionDateLabel || "No capturada")}</td>
            </tr>
            <tr>
              <td class="label">Revision</td>
              <td class="value">${escapeHtml(report.template.reportRevision)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderLogo(template) {
  if (template.logoMode === "image" && template.logoImageUrl) {
    return `<img src="${template.logoImageUrl}" alt="Logotipo">`;
  }
  return escapeHtml(template.logoText || "SB");
}

function renderFindingsTable(report) {
  if (!report.findings.length) {
    return `
      <table class="findings-table">
        <tr>
          <td><span class="muted">No se registraron hallazgos para este reporte.</span></td>
        </tr>
      </table>
    `;
  }

  return `
    <table class="findings-table">
      <thead>
        <tr>
          <th width="6%">No.</th>
          <th width="16%">Categoria</th>
          <th width="24%">Incidencia</th>
          <th width="42%">Descripcion</th>
          <th width="12%">Fotos</th>
        </tr>
      </thead>
      <tbody>
        ${report.findings.map((finding, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(finding.category || "")}</td>
            <td>${escapeHtml(finding.incidence || "")}</td>
            <td>${escapeHtml(finding.description || "")}</td>
            <td>${(finding.photos || []).length}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderEvidencePages(report) {
  if (!report.findings.length) {
    return "";
  }

  return report.findings.map((finding, index) => {
    const photos = Array.isArray(finding.photos) ? finding.photos : [];
    return `
      <section class="page">
        <div class="page-inner">
          ${renderHeader(report)}
          <div class="section-banner">Evidencia fotografica del hallazgo ${index + 1}</div>
          <table class="meta-table">
            <tr>
              <td width="20%"><div class="label">Categoria</div><div class="value">${escapeHtml(finding.category || "")}</div></td>
              <td width="28%"><div class="label">Incidencia</div><div class="value">${escapeHtml(finding.incidence || "")}</div></td>
              <td width="52%"><div class="label">Descripcion</div><div class="value">${escapeHtml(finding.description || "")}</div></td>
            </tr>
          </table>
          ${renderEvidenceTable(photos)}
        </div>

        <div class="footer">
          <span>${escapeHtml(report.reportNumber || "Sin folio")} | Hallazgo ${index + 1}</span>
          <span>Pagina <span class="page-number"></span></span>
        </div>
      </section>
    `;
  }).join("");
}

function renderEvidenceTable(photos) {
  if (!photos.length) {
    return `
      <table class="evidence-table">
        <tr>
          <td><span class="muted">No se adjuntaron fotografias para este hallazgo.</span></td>
        </tr>
      </table>
    `;
  }

  const rows = [];
  for (let index = 0; index < photos.length; index += 2) {
    rows.push(photos.slice(index, index + 2));
  }

  return `
    <table class="evidence-table">
      ${rows.map((row, rowIndex) => `
        <tr>
          ${row.map((photo, photoIndex) => `
            <td width="50%">
              <div class="label">Evidencia ${photoIndex + 1 + rowIndex * 2}</div>
              <img class="evidence-photo" src="${photo}" alt="Evidencia fotografica">
            </td>
          `).join("")}
          ${row.length === 1 ? '<td width="50%"></td>' : ''}
        </tr>
      `).join("")}
    </table>
  `;
}

function buildExecutiveSummary(report) {
  if (!report.findings.length) {
    return `Se realizo ${report.serviceType || "el servicio"} en ${report.plantName || "la planta"} el ${formatDate(report.inspectionDate) || "sin fecha"}. No se documentaron hallazgos durante la captura y la condicion general se registro como ${report.overallCondition || "pendiente"}.`;
  }

  return `Se realizo ${report.serviceType || "el servicio"} en ${report.plantName || "la planta"} el ${formatDate(report.inspectionDate) || "sin fecha"}. Se documentaron ${report.findings.length} hallazgo(s) con ${report.totalPhotos} evidencia(s) fotografica(s). La condicion general del equipo se registro como ${report.overallCondition || "pendiente"}.`;
}

function buildAutomaticRecommendations(findings, overallCondition) {
  if (!findings.length) {
    return `Mantener el programa de inspeccion vigente y repetir la evaluacion de acuerdo con la frecuencia recomendada. Condicion general registrada: ${overallCondition || "pendiente"}.`;
  }

  const grouped = summarizeByCategory(findings)
    .map((item) => `Atender observaciones de ${item.category.toLowerCase()} (${item.count}).`)
    .join(" ");

  return `${grouped} Verificar el cierre de acciones correctivas antes de la siguiente inspeccion. Condicion general registrada: ${overallCondition || "pendiente"}.`;
}

function summarizeByCategory(findings) {
  const counts = new Map();
  findings.forEach((finding) => {
    const category = finding.category || "Sin categoria";
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value + (value.length <= 10 ? "T12:00:00" : ""));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.openReportPdfWindow = openReportPdfWindow;





