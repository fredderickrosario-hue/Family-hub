/* ============================================================
   FAMILY HUB — shared UI helpers
   A generic modal form builder + toast, so every tab writes
   less markup and behaves consistently.
   ============================================================ */
import { escapeHtml } from "./state.js";
import { t } from "./i18n.js";

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg){
  let el = document.getElementById("toast");
  if (!el){
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Modal ---------- */
let currentModal = null;

export function closeModal(){
  if (currentModal){
    currentModal.remove();
    currentModal = null;
    document.removeEventListener("keydown", onKeydown);
  }
}
function onKeydown(e){ if (e.key === "Escape") closeModal(); }

/**
 * openModal({ title, submitLabel, deleteLabel, onSubmit, onDelete, fields })
 * field: { name, label, type, value, options, required, placeholder, min, step, hint }
 * types: text | number | date | time | textarea | select | checkbox | color | swatch
 */
export function openModal({ title, submitLabel, deleteLabel,
                            onSubmit, onDelete, fields = [], body = "" }){
  submitLabel = submitLabel || t("common.save");
  deleteLabel = deleteLabel || t("common.delete");
  closeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <h2>${escapeHtml(title)}</h2>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <form class="modal-form" novalidate></form>
    </div>`;

  const form = backdrop.querySelector(".modal-form");

  if (body){
    const b = document.createElement("div");
    b.className = "modal-body-text";
    b.innerHTML = body;              // caller is responsible for escaping
    form.appendChild(b);
  }

  fields.forEach(f => form.appendChild(buildField(f)));

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  if (onDelete){
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-danger-ghost";
    del.textContent = deleteLabel;
    del.addEventListener("click", async () => {
      del.disabled = true;
      try { await onDelete(); closeModal(); }
      catch (err){ console.error(err); toast(err && err.message ? err.message : t("common.error")); del.disabled = false; }
    });
    actions.appendChild(del);
  }
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary";
  submit.textContent = submitLabel;
  actions.appendChild(submit);
  form.appendChild(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {};
    let bad = null;
    fields.forEach(f => {
      const val = readField(form, f);
      if (f.required && (val === "" || val === null || val === undefined) && !bad){
        bad = form.querySelector(`[data-field="${f.name}"]`);
      }
      data[f.name] = val;
    });
    if (bad){
      bad.classList.add("invalid");
      bad.focus();
      return;
    }
    submit.disabled = true;
    try { await onSubmit(data); closeModal(); }
    catch (err){
      console.error(err);
      toast(err && err.message ? err.message : t("common.error"));
      submit.disabled = false;
    }
  });

  backdrop.querySelector(".modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(backdrop);
  currentModal = backdrop;

  const first = form.querySelector("input, select, textarea");
  if (first) setTimeout(() => first.focus(), 50);
}

function buildField(f){
  const wrap = document.createElement("label");
  wrap.className = "field";
  if (f.type === "checkbox") wrap.classList.add("field-inline");

  const id = `f_${f.name}`;
  const labelText = `<span class="field-label">${escapeHtml(f.label)}</span>`;

  let control = "";
  if (f.type === "textarea"){
    control = `<textarea id="${id}" data-field="${f.name}" rows="2"
      placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(f.value || "")}</textarea>`;
  } else if (f.type === "select"){
    const opts = (f.options || []).map(o =>
      `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(f.value ?? "") ? "selected" : ""}>${escapeHtml(o.label)}</option>`
    ).join("");
    control = `<select id="${id}" data-field="${f.name}">${opts}</select>`;
  } else if (f.type === "checkbox"){
    control = `<input type="checkbox" id="${id}" data-field="${f.name}" ${f.value ? "checked" : ""}>`;
  } else if (f.type === "swatch"){
    const opts = (f.options || []).map(c =>
      `<button type="button" class="swatch ${c === f.value ? "sel" : ""}" data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>`
    ).join("");
    control = `<div class="swatch-row" data-field="${f.name}" data-value="${escapeHtml(f.value || "")}">${opts}</div>`;
  } else {
    const extra = [
      f.min != null ? `min="${f.min}"` : "",
      f.step != null ? `step="${f.step}"` : "",
      f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ""
    ].join(" ");
    control = `<input type="${f.type || "text"}" id="${id}" data-field="${f.name}"
      value="${escapeHtml(f.value ?? "")}" ${extra}>`;
  }

  if (f.type === "checkbox"){
    wrap.innerHTML = control + labelText;
  } else {
    wrap.innerHTML = labelText + control + (f.hint ? `<span class="field-hint">${escapeHtml(f.hint)}</span>` : "");
  }

  // clear invalid state on input
  wrap.addEventListener("input", () => {
    wrap.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
  });

  if (f.type === "swatch"){
    const row = wrap.querySelector(".swatch-row");
    row.addEventListener("click", (e) => {
      const b = e.target.closest(".swatch");
      if (!b) return;
      row.dataset.value = b.dataset.color;
      row.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s === b));
    });
  }
  return wrap;
}

function readField(form, f){
  const el = form.querySelector(`[data-field="${f.name}"]`);
  if (!el) return null;
  if (f.type === "checkbox") return el.checked;
  if (f.type === "swatch") return el.dataset.value || "";
  if (f.type === "number"){
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : "";
  }
  return el.value.trim();
}

/* ---------- Confirm ---------- */
export function confirmAction(message){
  return window.confirm(message);
}
