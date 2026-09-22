import {MODEL_ORDER, RECORD_ORDER, createDefaultData} from "../data/models.js";
import {getFile, getAuditLogs} from "./database.js";
import {downloadBlob, formatBytes, escapeHtml} from "./ui.js";

/*
  Isolated File Command Center.
  This module intentionally does not modify app.js, record rendering, model selection,
  upload handlers, or existing click handlers. It only owns its own modal and button.
*/

const DATA_KEY = "MOBILE_RND_DB_DATA_V10";
let rows = [];
let objectUrl = null;

function loadData() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY)) || createDefaultData(); }
  catch { return createDefaultData(); }
}

async function collectRecords() {
  const data = loadData();
  const out = [];
  for (const model of MODEL_ORDER) {
    const items = data[model]?.items || {};
    for (const key of RECORD_ORDER) {
      const item = items[key];
      if (!item) continue;
      try {
        const stored = await getFile(`${model}_${key}`);
        if (!stored?.blob) continue;
        out.push({
          model,
          key,
          title: item.title || key,
          category: item.category || "General",
          filename: stored.filename || item.filename || "Uploaded file",
          size: stored.size ? formatBytes(stored.size) : (item.size || "—")
        });
      } catch (err) {
        console.warn("File Command Center lookup failed", model, key, err);
      }
    }
  }
  return out;
}

function iconFor(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "fa-file-pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "fa-file-excel";
  if (["doc", "docx"].includes(ext)) return "fa-file-word";
  if (["ppt", "pptx"].includes(ext)) return "fa-file-powerpoint";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "fa-file-image";
  if (["zip", "bin"].includes(ext)) return "fa-file-zipper";
  return "fa-file-lines";
}

function extOf(filename = "") { return filename.split(".").pop().toLowerCase(); }

function modal() { return document.getElementById("fileCenterModal"); }
function close() { modal()?.classList.add("hidden"); clearPreview(); }
function open() { modal()?.classList.remove("hidden"); refresh(); }

function renderModelOptions() {
  const select = document.getElementById("fileCenterModel");
  if (!select || select.options.length > 1) return;
  select.innerHTML = `<option value="">All models</option>` + MODEL_ORDER.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
}

function filtered() {
  const q = (document.getElementById("fileCenterSearch")?.value || "").trim().toLowerCase();
  const model = document.getElementById("fileCenterModel")?.value || "";
  return rows.filter(r => (!model || r.model === model) && (!q || `${r.model} ${r.key} ${r.title} ${r.category} ${r.filename}`.toLowerCase().includes(q)));
}

function render() {
  const list = document.getElementById("fileCenterList");
  const count = document.getElementById("fileCenterCount");
  if (!list) return;
  const items = filtered();
  if (count) count.textContent = `${items.length} file${items.length === 1 ? "" : "s"}`;
  if (!items.length) {
    list.innerHTML = `<div class="file-center-empty"><i class="fa-solid fa-folder-open"></i><strong>No uploaded files found</strong><span>Use Upload from the Admin controls to add an engineering file.</span></div>`;
    return;
  }
  list.innerHTML = items.map((r, i) => `
    <div class="file-center-row" data-index="${i}">
      <div class="file-center-icon"><i class="fa-solid ${iconFor(r.filename)}"></i></div>
      <div class="file-center-main">
        <strong title="${escapeHtml(r.filename)}">${escapeHtml(r.filename)}</strong>
        <span>${escapeHtml(r.model)} · ${escapeHtml(r.key)} · ${escapeHtml(r.category)} · ${escapeHtml(r.size)}</span>
      </div>
      <div class="file-center-actions">
        <button type="button" class="fc-action" data-action="preview" title="Preview"><i class="fa-solid fa-eye"></i></button>
        <button type="button" class="fc-action" data-action="download" title="Download"><i class="fa-solid fa-download"></i></button>
      </div>
    </div>`).join("");
}

async function recentUploads() {
  const el = document.getElementById("fileCenterRecent");
  if (!el) return;
  try {
    const logs = await getAuditLogs(30);
    const uploads = (logs || []).filter(x => x.action === "UPLOAD").slice(0, 5);
    el.innerHTML = uploads.length ? uploads.map(x => {
      const d = (x.at || x.timestamp) ? new Date(x.at || x.timestamp).toLocaleString() : "";
      const p = x.details || {};
      return `<div class="file-center-recent-item"><i class="fa-solid fa-cloud-arrow-up"></i><span><strong>${escapeHtml(p.filename || "Engineering file")}</strong><small>${escapeHtml(p.model || "")} · ${escapeHtml(p.key || "")} · ${escapeHtml(d)}</small></span></div>`;
    }).join("") : `<div class="file-center-recent-empty">No recent uploads recorded.</div>`;
  } catch {
    el.innerHTML = `<div class="file-center-recent-empty">Recent upload history is unavailable.</div>`;
  }
}

function clearPreview() {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  const body = document.getElementById("filePreviewBody");
  if (body) body.innerHTML = "";
}

async function getSelected(row) {
  return getFile(`${row.model}_${row.key}`);
}

async function downloadRow(row) {
  const record = await getSelected(row);
  if (!record?.blob) throw new Error("File is not present in local storage.");
  const ok = downloadBlob(record.blob, record.filename || row.filename);
  if (!ok) throw new Error("Browser blocked the download.");
}

async function previewRow(row) {
  const record = await getSelected(row);
  if (!record?.blob) throw new Error("File is not present in local storage.");
  clearPreview();
  objectUrl = URL.createObjectURL(record.blob);
  const body = document.getElementById("filePreviewBody");
  const title = document.getElementById("filePreviewTitle");
  const meta = document.getElementById("filePreviewMeta");
  if (title) title.textContent = record.filename || row.filename;
  if (meta) meta.textContent = `${row.model} · ${row.key} · ${formatBytes(record.blob.size)} · ${record.blob.type || "unknown type"}`;
  if (!body) return;
  const ext = extOf(record.filename || row.filename);
  if (record.blob.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    body.innerHTML = `<img class="file-preview-image" src="${objectUrl}" alt="${escapeHtml(record.filename || row.filename)}">`;
  } else if (record.blob.type === "application/pdf" || ext === "pdf") {
    body.innerHTML = `<iframe class="file-preview-frame" src="${objectUrl}" title="PDF preview"></iframe>`;
  } else if (record.blob.type.startsWith("text/") || ["csv", "txt"].includes(ext)) {
    const text = await record.blob.text();
    body.innerHTML = `<pre class="file-preview-text">${escapeHtml(text.slice(0, 200000))}</pre>`;
  } else {
    body.innerHTML = `<div class="file-preview-unsupported"><i class="fa-solid ${iconFor(row.filename)}"></i><strong>Preview not available for this file type.</strong><span>You can download the original file from the command center.</span><button type="button" class="btn btn-dark" id="previewDownloadBtn"><i class="fa-solid fa-download"></i> Download</button></div>`;
    document.getElementById("previewDownloadBtn")?.addEventListener("click", () => downloadRow(row).catch(e => window.alert(e.message)));
  }
  document.getElementById("filePreviewModal")?.classList.remove("hidden");
}

async function refresh() {
  rows = await collectRecords();
  renderModelOptions();
  render();
  recentUploads();
}

function bind() {
  const btn = document.getElementById("fileCenterBtn");
  if (!btn) return;
  btn.addEventListener("click", open);
  document.getElementById("fileCenterRefresh")?.addEventListener("click", () => refresh());
  document.getElementById("fileCenterSearch")?.addEventListener("input", render);
  document.getElementById("fileCenterModel")?.addEventListener("change", render);
  document.querySelectorAll("[data-close-file-center]").forEach(b => b.addEventListener("click", () => document.getElementById(b.dataset.closeFileCenter)?.classList.add("hidden")));
  document.getElementById("fileCenterModal")?.addEventListener("click", async e => {
    if (e.target.classList.contains("modal-backdrop")) { close(); return; }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const rowEl = e.target.closest(".file-center-row");
    const row = rowEl ? filtered()[Number(rowEl.dataset.index)] : null;
    if (!row) return;
    try {
      if (action === "download") await downloadRow(row);
      if (action === "preview") await previewRow(row);
    } catch (err) {
      window.alert(err?.message || "File operation failed.");
    }
  });
  document.getElementById("filePreviewModal")?.addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) document.getElementById("filePreviewModal").classList.add("hidden"); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    document.getElementById("filePreviewModal")?.classList.add("hidden");
    close();
  });
}

document.addEventListener("DOMContentLoaded", bind);
