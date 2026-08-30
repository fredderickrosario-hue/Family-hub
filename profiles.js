/* ============================================================
   FAMILY HUB — Family tab
   Color-coded profiles: the star of the app. Add/edit family
   members, set colors, mark kids, adjust points.
   ============================================================ */
import {
  state, onStateChange, add, update, remove, escapeHtml, profileInitials
} from "./state.js";
import { openModal, toast, confirmAction } from "./ui.js";
import { t } from "./i18n.js";

let panel;

const PALETTE = ["#4FA89B", "#FFB84D", "#B19CD9", "#FF85A2",
                 "#5C9EDB", "#7BC96F", "#E8735E", "#E0B54C"];

export function initFamily(){
  panel = document.getElementById("panel-family");
  panel.innerHTML = `
    <div class="panel-head">
      <h2>${escapeHtml(t("family.title"))}</h2>
      <button class="btn-add" id="profileAdd"><span class="plus">+</span> ${escapeHtml(t("family.add"))}</button>
    </div>
    <p class="sub" style="margin:0 4px 12px;">${escapeHtml(t("family.blurb"))}</p>
    <div class="profile-grid" id="profileGrid"></div>
  `;
  panel.querySelector("#profileAdd").addEventListener("click", () => openProfileForm());
  panel.querySelector("#profileGrid").addEventListener("click", onClick);
  onStateChange(render);
  render();
}

function render(){
  if (!panel) return;
  const grid = panel.querySelector("#profileGrid");
  if (!state.profiles.length){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">${escapeHtml(t("family.empty"))}</div>`;
    return;
  }
  grid.innerHTML = state.profiles
    .slice()
    .sort((a, b) => Number(b.isKid) - Number(a.isKid) || a.name.localeCompare(b.name))
    .map(p => `
      <div class="profile-card" data-id="${p.id}" style="--chip-color:${p.color}">
        <div class="avatar lg" style="--chip-color:${p.color}">${escapeHtml(profileInitials(p))}</div>
        <div class="p-name">${escapeHtml(p.name)}</div>
        <div class="p-role">${p.isKid ? escapeHtml(t("family.kid")) : escapeHtml(t("family.adult"))}</div>
        ${p.isKid ? `<div class="p-pts">${escapeHtml(t("family.pts", { n: p.points || 0 }))}</div>` : ""}
      </div>`).join("");
}

function onClick(e){
  const cardEl = e.target.closest(".profile-card");
  if (!cardEl) return;
  const p = state.profiles.find(x => x.id === cardEl.dataset.id);
  if (p) openProfileForm(p);
}

function nextColor(){
  const used = new Set(state.profiles.map(p => (p.color || "").toLowerCase()));
  return PALETTE.find(c => !used.has(c.toLowerCase())) || PALETTE[state.profiles.length % PALETTE.length];
}

function openProfileForm(p){
  const fields = [
    { name: "name", label: t("family.f_name"), type: "text", required: true, value: p?.name || "" },
    { name: "color", label: t("family.f_color"), type: "swatch", options: PALETTE, value: p?.color || nextColor() },
    { name: "avatar", label: t("family.f_avatar"), type: "text", value: p?.avatar || "" },
    { name: "isKid", label: t("family.f_kid"), type: "checkbox", value: p?.isKid ?? false }
  ];
  if (p?.isKid || p == null){
    fields.push({ name: "points", label: t("family.f_points"), type: "number", min: 0, value: p?.points ?? 0 });
  }

  openModal({
    title: p ? t("family.edit") : t("family.new"),
    fields,
    onDelete: p ? async () => {
      if (!confirmAction(`${t("common.delete")} ${p.name}?`)) throw new Error("cancelled");
      await remove("profiles", p.id);
      toast(t("common.saved"));
    } : null,
    onSubmit: async (d) => {
      const payload = {
        name: d.name,
        color: d.color || PALETTE[0],
        avatar: (d.avatar || "").trim().slice(0, 2),
        isKid: !!d.isKid,
        points: d.isKid ? (Number(d.points) || 0) : 0
      };
      if (p) await update("profiles", p.id, payload);
      else await add("profiles", payload);
      toast(t("common.saved"));
    }
  });
}
