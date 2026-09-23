import {
  freshData,
  validateData,
  uid,
  toKg,
  displayWeight,
  exerciseSets,
  lastWorkoutSets,
  workoutGroups,
  bestSet,
  isPr,
} from "./model.js";
import {
  loadData,
  saveData,
  loadHandle,
  saveHandle,
  clearHandle,
} from "./db.js";
import {
  readIronlog,
  chooseSaveHandle,
  writeHandle,
  downloadFile,
} from "./file.js";

const app = document.querySelector("#app");
const toastElement = document.querySelector("#toast");
let data = null;
let handle = null;
let view = "welcome";
let selectedId = null;
let search = "";
let modal = null;
let busy = false;
let fileFresh = false;
let fileNotice = "";
let pending = Promise.resolve();
let toastTimer;

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const dateText = (iso, withTime = false) =>
  new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
const weightText = (set) =>
  `${displayWeight(set.weightKg, data.settings.unit)} ${data.settings.unit}`;
const icon = (name, size = 22) => {
  const paths = {
    arrow: '<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
    back: '<path d="m19 12-14 0m6-6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="m4 20 4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
    close: '<path d="M5 5 19 19M19 5 5 19"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    file: '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v6h5M9 14h6m-6 4h6"/>',
    chart: '<path d="M4 19h16M5 15l5-5 4 3 5-8"/>',
    settings: '<path d="M4 7h16M7 4v6M4 17h16m6-3v6"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1"/><path d="m4 17 5-5 4 3 3-3 5 5"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};
const logo = `<span class="mark" aria-hidden="true"><span>IL</span><i></i></span>`;

function toast(message, kind = "") {
  toastElement.textContent = message;
  toastElement.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastElement.className = "";
  }, 4200);
}
function errorMessage(error) {
  return error?.name === "AbortError"
    ? null
    : error?.message || "Une erreur est survenue.";
}
function showError(error) {
  const message = errorMessage(error);
  if (message) toast(message, "error");
}
function setBusy(value) {
  busy = value;
  document.body.classList.toggle("is-busy", value);
}
function render() {
  app.innerHTML =
    !data || view === "welcome"
      ? welcomePage()
      : view === "exercise"
        ? exercisePage()
        : view === "settings"
          ? settingsPage()
          : homePage();
  if (modal) app.insertAdjacentHTML("beforeend", modalHtml());
  bindEvents();
}
function shell(content, title = "IRONLOG") {
  return `<div class="shell"><header class="topbar"><button class="brand" data-action="home" aria-label="Accueil IRONLOG">${logo}<span>IRONLOG</span></button><div class="topbar-right"><span class="topbar-line">LIFT. LOG. REPEAT.</span><button class="icon-btn" data-action="settings" aria-label="Réglages">${icon("settings")}</button></div></header>${content}<nav class="bottom-nav" aria-label="Navigation"><button class="${view === "home" ? "active" : ""}" data-action="home"><span class="nav-glyph">▦</span>Exercices</button><button class="${view === "settings" ? "active" : ""}" data-action="settings">${icon("settings", 20)}Réglages</button></nav></div>`;
}
function welcomePage() {
  return `<main class="welcome"><div class="welcome-glow"></div><div class="welcome-content"><div class="welcome-brand">${logo}<span>IRONLOG</span></div><div class="welcome-main"><div class="eyebrow"><span class="red-line"></span> LE CARNET QUI SUIT VOTRE FORCE</div><h1>LIFT.<br>LOG.<br><em>REPEAT.</em></h1><p>Vos charges, vos séries, votre progression. Toujours à portée de main.</p><div class="welcome-actions">${data ? `<button class="primary-btn" data-action="continue">Continuer ${icon("arrow")}</button>` : `<button class="primary-btn" data-action="create">Créer mon IRONLOG ${icon("arrow")}</button>`}<button class="outline-btn" data-action="open">Ouvrir mon IRONLOG ${icon("file")}</button></div></div><div class="welcome-foot">PRIVÉ · HORS LIGNE · À VOUS</div></div></main>`;
}
function homePage() {
  const items = data.exercises.filter((exercise) =>
    exercise.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const count = data.exercises.length;
  return shell(`<main class="page home"><div class="page-heading"><div><div class="eyebrow">VOTRE TERRAIN</div><h1>Exercices<span class="heading-dot">.</span></h1><p>${count ? `${count} exercice${count > 1 ? "s" : ""} à votre rythme.` : "Commencez par votre premier exercice."}</p></div><span class="section-number">01 / LOG</span></div>
    ${data.activeWorkoutId ? `<div class="session-banner"><div><span class="pulse"></span><strong>ENTRAÎNEMENT EN COURS</strong><span>${data.sets.filter((set) => set.workoutId === data.activeWorkoutId).length} séries enregistrées</span></div><button data-action="finish">Terminer ${icon("arrow", 18)}</button></div>` : ""}
    ${count > 5 ? `<label class="search-box"><span class="sr-only">Rechercher un exercice</span><input id="search" type="search" placeholder="Rechercher un exercice…" value="${esc(search)}" autocomplete="off"></label>` : ""}
    <div class="exercise-list">${items.map((exercise, index) => exerciseCard(exercise, index)).join("")}${!items.length && count ? `<div class="empty-search">Aucun exercice trouvé.</div>` : ""}</div>
    ${!count ? `<div class="empty-state"><div class="empty-symbol">${logo}</div><div class="eyebrow">PRÊT QUAND VOUS L'ÊTES</div><h2>Chaque rep compte.</h2><p>Ajoutez un exercice. Votre prochaine performance commence ici.</p><button class="primary-btn" data-action="new-exercise">${icon("plus")} Ajouter un exercice</button></div>` : `<button class="add-card" data-action="new-exercise">${icon("plus")}<span>Ajouter un exercice</span>${icon("arrow")}</button>`}
    ${!fileFresh ? `<div class="backup-note">${icon("file", 19)}<span>${fileNotice || "Vos données sont enregistrées sur cet appareil."} <button class="text-link" data-action="save-file">Enregistrer mon fichier IRONLOG</button></span></div>` : ""}
  </main>`);
}
function exerciseCard(exercise, index) {
  const sets = exerciseSets(data, exercise.id);
  const last = lastWorkoutSets(data, exercise.id);
  const best = bestSet(sets);
  return `<button class="exercise-card" data-action="exercise" data-id="${esc(exercise.id)}"><div class="exercise-image">${exercise.photo ? `<img src="${exercise.photo}" alt="">` : `<div class="image-placeholder"><span>IL</span></div>`}</div><div class="exercise-card-info"><span class="card-index">${String(index + 1).padStart(2, "0")} / EXERCICE</span><strong>${esc(exercise.name)}</strong><span class="card-meta">${last.length ? `Dernière · ${weightText(last[last.length - 1])} × ${last[last.length - 1].reps}` : "Aucune série enregistrée"}</span></div><div class="card-end">${best ? `<span class="card-best">PR<br><b>${displayWeight(best.weightKg, data.settings.unit)}</b></span>` : ""}${icon("arrow", 20)}</div></button>`;
}
function exercisePage() {
  const exercise = data.exercises.find((x) => x.id === selectedId);
  if (!exercise) {
    view = "home";
    return homePage();
  }
  const all = exerciseSets(data, selectedId);
  const groups = workoutGroups(data, selectedId);
  const current = data.activeWorkoutId
    ? data.sets
        .filter(
          (set) =>
            set.workoutId === data.activeWorkoutId &&
            set.exerciseId === selectedId,
        )
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : [];
  const previous = groups.find(
    (group) => group.workout.id !== data.activeWorkoutId,
  );
  const previousBest = previous ? bestSet(previous.sets) : null;
  const best = bestSet(all);
  const chartPoints = [...groups]
    .reverse()
    .map((group) => bestSet(group.sets)?.weightKg || 0);
  return shell(`<main class="page detail"><button class="back-link" data-action="home">${icon("back", 18)} TOUS LES EXERCICES</button><div class="detail-hero"><div class="detail-photo">${exercise.photo ? `<img src="${exercise.photo}" alt="Photo de ${esc(exercise.name)}">` : `<div class="image-placeholder large"><span>IL</span></div>`}</div><div class="detail-intro"><div class="eyebrow">EXERCICE / ${dateText(exercise.createdAt)}</div><h1>${esc(exercise.name)}<span class="heading-dot">.</span></h1><button class="subtle-btn" data-action="edit-exercise">${icon("edit", 17)} Modifier</button></div></div>
    <section class="last-panel"><div class="panel-label">DERNIÈRE PERFORMANCE <span>${previous ? dateText(previous.workout.startedAt) : "À VENIR"}</span></div>${previous ? `<div class="last-big">${weightText(previousBest)}<small>× ${previousBest.reps} reps</small></div><div class="last-series">${previous.sets.map((set) => `<span>${weightText(set)} × ${set.reps}</span>`).join("")}</div>` : `<p class="panel-empty">Ajoutez votre première série pour créer un point de départ.</p>`}</section>
    <section class="work-section"><div class="section-head"><div><div class="eyebrow">MAINTENANT</div><h2>${data.activeWorkoutId ? "Séance en cours" : "À vous de jouer"}</h2></div><span class="section-number">${String(current.length).padStart(2, "0")} SÉRIES</span></div>${current.length ? `<div class="set-list">${current.map((set, index) => setRow(set, index + 1, true)).join("")}</div>` : `<p class="muted-intro">Votre séance démarre automatiquement avec la première série.</p>`}<button class="primary-btn wide" data-action="add-set">${icon("plus")} Ajouter une série</button>${data.activeWorkoutId ? `<button class="finish-link" data-action="finish">Terminer l'entraînement ${icon("arrow", 18)}</button>` : ""}</section>
    <section class="stats-grid"><div class="stat-card"><span>RECORD PERSONNEL</span><strong>${best ? displayWeight(best.weightKg, data.settings.unit) : "—"} <small>${best ? data.settings.unit : ""}</small></strong><p>${best ? `${best.reps} reps · ${dateText(best.createdAt)}` : "Votre meilleur poids apparaîtra ici."}</p></div><div class="stat-card"><span>PROGRESSION</span>${chartPoints.length > 1 ? `<div class="sparkline">${sparkline(chartPoints)}</div><p>Meilleure charge par séance</p>` : `<strong class="stat-empty">—</strong><p>Après deux séances, suivez votre évolution.</p>`}</div></section>
    <section class="history-section"><div class="section-head"><div><div class="eyebrow">LE CHEMIN PARCOURU</div><h2>Historique</h2></div><span class="section-number">${String(groups.length).padStart(2, "0")} SÉANCES</span></div>${groups.length ? groups.map((group) => `<div class="history-group"><div class="history-date"><strong>${dateText(group.workout.startedAt)}</strong><span>${group.workout.endedAt ? "TERMINÉE" : "EN COURS"}</span></div>${group.sets.map((set, index) => setRow(set, index + 1, false)).join("")}</div>`).join("") : `<p class="muted-intro">Votre historique apparaîtra ici après votre première série.</p>`}</section>
  </main>`);
}
function setRow(set, index, active) {
  return `<div class="set-row"><span class="set-index">${String(index).padStart(2, "0")}</span><strong>${weightText(set)} <span>× ${set.reps}</span></strong><button class="icon-btn small" data-action="edit-set" data-id="${esc(set.id)}" aria-label="Modifier la série ${index}">${icon("edit", 18)}</button>${active ? `<span class="set-active-dot"></span>` : ""}</div>`;
}
function sparkline(values) {
  const width = 240,
    height = 66,
    min = Math.min(...values),
    max = Math.max(...values),
    spread = max - min || 1;
  const points = values
    .map(
      (value, index) =>
        `${6 + (index * (width - 12)) / (values.length - 1)},${height - 8 - ((value - min) / spread) * (height - 16)}`,
    )
    .join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Progression de la meilleure charge par séance"><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points.split(" ").at(-1).split(",")[0]}" cy="${points.split(" ").at(-1).split(",")[1]}" r="5" fill="var(--accent)"/></svg>`;
}
function settingsPage() {
  return shell(
    `<main class="page settings-page"><div class="page-heading"><div><div class="eyebrow">VOTRE ESPACE</div><h1>Réglages<span class="heading-dot">.</span></h1><p>Vos données restent sur votre appareil.</p></div><span class="section-number">02 / SETUP</span></div><section class="settings-section"><div class="eyebrow">AFFICHAGE</div><h2>Unité de poids</h2><div class="segmented" role="group" aria-label="Unité de poids"><button class="${data.settings.unit === "lb" ? "active" : ""}" data-action="unit" data-unit="lb">LIVRES <small>lb</small></button><button class="${data.settings.unit === "kg" ? "active" : ""}" data-action="unit" data-unit="kg">KILOS <small>kg</small></button></div><p>Les charges enregistrées sont converties automatiquement.</p></section><section class="settings-section"><div class="eyebrow">VOTRE FICHIER</div><h2>Gardez la maîtrise.</h2><p>IRONLOG enregistre chaque changement sur cet appareil. Conservez aussi votre fichier IRONLOG pour retrouver vos données sur un autre appareil.</p><div class="setting-actions"><button class="primary-btn" data-action="save-file">${icon("file")} Enregistrer mon fichier</button><button class="outline-btn" data-action="backup">Créer une copie de sauvegarde ${icon("arrow")}</button><button class="outline-btn" data-action="open">Ouvrir un fichier IRONLOG ${icon("arrow")}</button></div><div class="info-line">${fileFresh ? `${icon("check", 18)} Fichier enregistré pendant cette visite` : `${icon("file", 18)} Pensez à enregistrer votre fichier régulièrement`}</div></section><section class="settings-section about"><div class="eyebrow">IRONLOG / V1</div><h2>Lift. Log. Repeat.</h2><p>Sans compte. Sans cloud IRONLOG. Sans suivi publicitaire. Vos données vous appartiennent.</p></section></main>`,
  );
}
function modalHtml() {
  if (modal.type === "exercise") {
    const exercise = modal.id
      ? data.exercises.find((x) => x.id === modal.id)
      : null;
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-top"><div><div class="eyebrow">${exercise ? "MODIFIER" : "NOUVEAU"}</div><h2 id="modal-title">${exercise ? "Votre exercice" : "Ajouter un exercice"}<span class="heading-dot">.</span></h2></div><button class="icon-btn" data-action="close" aria-label="Fermer">${icon("close")}</button></div><form id="exercise-form"><label class="field-label" for="exercise-name">NOM DE L'EXERCICE</label><input id="exercise-name" name="name" class="text-input" maxlength="100" required placeholder="Ex. : Développé couché" value="${esc(exercise?.name || "")}" autofocus><label class="photo-input" for="exercise-photo">${icon("image")}<span>${exercise?.photo ? "Remplacer la photo" : "Ajouter une photo (facultatif)"}</span></label><input id="exercise-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden><p class="field-help">La photo est réduite sur cet appareil et incluse dans votre fichier.</p><button class="primary-btn wide" type="submit">${exercise ? "Enregistrer" : "Créer l’exercice"} ${icon("arrow")}</button></form>${exercise ? `<button class="danger-link" data-action="delete-exercise">${icon("trash", 18)} Supprimer cet exercice</button>` : ""}</section></div>`;
  }
  if (modal.type === "set") {
    const set = modal.id ? data.sets.find((x) => x.id === modal.id) : null;
    const last = lastWorkoutSets(data, selectedId).at(-1);
    const weight = set
      ? Number(
          (
            set.weightKg * (data.settings.unit === "lb" ? 2.2046226218 : 1)
          ).toFixed(1),
        )
      : last
        ? Number(
            (
              last.weightKg * (data.settings.unit === "lb" ? 2.2046226218 : 1)
            ).toFixed(1),
          )
        : "";
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-top"><div><div class="eyebrow">${set ? "CORRIGER" : "ENREGISTRER"}</div><h2 id="modal-title">${set ? "Modifier la série" : "Nouvelle série"}<span class="heading-dot">.</span></h2></div><button class="icon-btn" data-action="close" aria-label="Fermer">${icon("close")}</button></div><form id="set-form"><div class="number-fields"><label><span>POIDS <em>${data.settings.unit}</em></span><input name="weight" inputmode="decimal" type="number" min="0" max="4409" step="any" required value="${weight}" placeholder="0" autofocus></label><label><span>RÉPÉTITIONS</span><input name="reps" inputmode="numeric" type="number" min="1" max="1000" step="1" required value="${set?.reps ?? last?.reps ?? ""}" placeholder="0"></label></div><button class="primary-btn wide" type="submit">${set ? "Enregistrer les modifications" : "Ajouter la série"} ${icon("check")}</button></form>${set ? `<button class="danger-link" data-action="delete-set">${icon("trash", 18)} Supprimer cette série</button>` : ""}</section></div>`;
  }
  return "";
}

function bindEvents() {
  app.querySelectorAll("[data-action]").forEach((element) =>
    element.addEventListener("click", (event) => {
      event.preventDefault();
      onAction(element.dataset.action, element.dataset);
    }),
  );
  app.querySelector("#exercise-form")?.addEventListener("submit", saveExercise);
  app.querySelector("#set-form")?.addEventListener("submit", saveSet);
  app.querySelector("#search")?.addEventListener("input", (event) => {
    search = event.target.value;
    const start = event.target.selectionStart;
    render();
    const input = app.querySelector("#search");
    input.focus();
    input.setSelectionRange(start, start);
  });
  app.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
  app.querySelector("#exercise-name")?.focus();
  app.querySelector("#set-form input")?.focus();
}
function closeModal() {
  modal = null;
  render();
}
function mutate(operation) {
  pending = pending
    .catch(() => {})
    .then(async () => {
      const next = structuredClone(data);
      const result = operation(next);
      next.updatedAt = new Date().toISOString();
      validateData(next);
      await saveData(next);
      data = next;
      fileFresh = false;
      render();
      return result;
    });
  return pending;
}
async function onAction(action, args) {
  if (busy) return;
  try {
    switch (action) {
      case "home":
        view = "home";
        modal = null;
        render();
        break;
      case "settings":
        view = "settings";
        modal = null;
        render();
        break;
      case "continue":
        view = "home";
        render();
        break;
      case "exercise":
        selectedId = args.id;
        view = "exercise";
        render();
        break;
      case "new-exercise":
        modal = { type: "exercise" };
        render();
        break;
      case "edit-exercise":
        modal = { type: "exercise", id: selectedId };
        render();
        break;
      case "add-set":
        modal = { type: "set" };
        render();
        break;
      case "edit-set":
        modal = { type: "set", id: args.id };
        render();
        break;
      case "close":
        closeModal();
        break;
      case "create":
        await createIronlog();
        break;
      case "open":
        await openIronlog();
        break;
      case "save-file":
        await saveFile(false);
        break;
      case "backup":
        await saveFile(true);
        break;
      case "finish":
        await finishWorkout();
        break;
      case "unit":
        if (args.unit !== data.settings.unit)
          await mutate((next) => {
            next.settings.unit = args.unit;
          });
        break;
      case "delete-exercise":
        await deleteExercise();
        break;
      case "delete-set":
        await deleteSet();
        break;
    }
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}
async function createIronlog() {
  setBusy(true);
  const next = freshData();
  await saveData(next);
  data = next;
  view = "home";
  render();
  toast("IRONLOG est prêt. Ajoutez votre premier exercice.");
  await saveFile(false);
}
async function openIronlog() {
  if (typeof globalThis.showOpenFilePicker === "function") {
    try {
      const [chosen] = await showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Fichier IRONLOG",
            accept: { "application/json": [".ironlog", ".json"] },
          },
        ],
      });
      if (chosen) await importIronlog(await chosen.getFile(), chosen);
    } catch (error) {
      showError(error);
    }
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".ironlog,.json,application/json";
  input.addEventListener(
    "change",
    async () => {
      if (!input.files?.[0]) return;
      await importIronlog(input.files[0], null);
    },
    { once: true },
  );
  input.click();
}
async function importIronlog(file, newHandle) {
  setBusy(true);
  try {
    const next = await readIronlog(file);
    if (
      data &&
      !confirm(
        "Ouvrir ce fichier remplacera les données enregistrées sur cet appareil. Continuer ?",
      )
    )
      return;
    await clearHandle();
    handle = null;
    await saveData(next);
    if (newHandle) {
      try {
        await saveHandle(newHandle);
        handle = newHandle;
      } catch {
        await clearHandle().catch(() => {});
      }
    }
    data = next;
    fileFresh = true;
    fileNotice = "";
    view = "home";
    modal = null;
    selectedId = null;
    search = "";
    render();
    toast("Votre IRONLOG a été ouvert.");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}
async function saveFile(copy = false) {
  if (!data) return;
  setBusy(true);
  let selectedHandle = null;
  try {
    if (!copy && handle) {
      try {
        await writeHandle(handle, data);
      } catch {
        handle = null;
        await clearHandle().catch(() => {});
        throw new Error(
          "Accès à l’ancien fichier perdu. Vos données restent sur cet appareil. Touchez de nouveau « Enregistrer mon fichier » pour choisir un fichier.",
        );
      }
      fileFresh = true;
      fileNotice = "";
      render();
      toast("Fichier IRONLOG mis à jour.");
      return;
    }
    if (typeof globalThis.showSaveFilePicker === "function") {
      selectedHandle = await chooseSaveHandle();
      await writeHandle(selectedHandle, data);
      if (!copy) {
        await saveHandle(selectedHandle);
        handle = selectedHandle;
        fileFresh = true;
        fileNotice = "";
      }
      render();
      toast(
        copy ? "Copie de sauvegarde créée." : "Fichier IRONLOG enregistré.",
      );
      return;
    }
    downloadFile(
      data,
      copy
        ? `IRONLOG-copie-${new Date().toISOString().replace(/[:.]/g, "-")}.ironlog`
        : "IRONLOG.ironlog",
    );
    fileFresh = false;
    fileNotice =
      "Téléchargement lancé. Dans Fichiers, enregistrez ce fichier et remplacez votre ancienne copie IRONLOG.";
    render();
    toast(
      copy
        ? "Copie téléchargée. Conservez-la en lieu sûr."
        : "Téléchargement lancé. Dans Fichiers, remplacez votre ancien IRONLOG.",
    );
  } catch (error) {
    if (selectedHandle && !copy) await clearHandle().catch(() => {});
    showError(error);
  } finally {
    setBusy(false);
  }
}
async function finishWorkout() {
  if (!data.activeWorkoutId) return;
  setBusy(true);
  await mutate((next) => {
    const workout = next.workouts.find(
      (item) => item.id === next.activeWorkoutId,
    );
    workout.endedAt = new Date().toISOString();
    next.activeWorkoutId = null;
  });
  toast("Entraînement terminé. Données enregistrées sur cet appareil.");
  await saveFile(false);
}
async function saveExercise(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  if (!name) return;
  setBusy(true);
  try {
    const file = form.elements.photo.files?.[0];
    const photo = file ? await preparePhoto(file) : undefined;
    const id = modal.id;
    await mutate((next) => {
      if (id) {
        const exercise = next.exercises.find((item) => item.id === id);
        exercise.name = name;
        if (photo) exercise.photo = photo;
      } else {
        const newId = uid();
        next.exercises.push({
          id: newId,
          name,
          photo: photo || null,
          createdAt: new Date().toISOString(),
        });
        selectedId = newId;
      }
    });
    modal = null;
    view = "exercise";
    render();
    toast(id ? "Exercice modifié." : "Exercice ajouté.");
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}
async function preparePhoto(file) {
  if (!file.type.startsWith("image/"))
    throw new Error("Choisissez une image valide.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Photo trop volumineuse (20 Mo maximum).");
  let image;
  if (typeof createImageBitmap === "function")
    image = await createImageBitmap(file).catch(() => null);
  if (!image) {
    const url = URL.createObjectURL(file);
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Impossible de lire cette photo."));
      img.src = url;
    }).finally(() => URL.revokeObjectURL(url));
  }
  const scale = Math.min(1, 900 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  let quality = 0.78,
    result = canvas.toDataURL("image/jpeg", quality);
  while (result.length > 700000 && quality > 0.4) {
    quality -= 0.1;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  if (result.length > 1000000)
    throw new Error(
      "Cette photo reste trop volumineuse. Choisissez-en une autre.",
    );
  return result;
}
async function saveSet(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const weight = Number(form.elements.weight.value);
  const reps = Number(form.elements.reps.value);
  if (
    !Number.isFinite(weight) ||
    weight < 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > 1000
  ) {
    toast("Entrez un poids et un nombre de répétitions valides.", "error");
    return;
  }
  setBusy(true);
  try {
    const id = modal.id;
    const pr =
      !id &&
      isPr(
        { weightKg: toKg(weight, data.settings.unit), reps },
        exerciseSets(data, selectedId),
      );
    await mutate((next) => {
      if (id) {
        const set = next.sets.find((item) => item.id === id);
        set.weightKg = toKg(weight, next.settings.unit);
        set.reps = reps;
      } else {
        if (!next.activeWorkoutId) {
          next.activeWorkoutId = uid();
          next.workouts.push({
            id: next.activeWorkoutId,
            startedAt: new Date().toISOString(),
            endedAt: null,
          });
        }
        next.sets.push({
          id: uid(),
          exerciseId: selectedId,
          workoutId: next.activeWorkoutId,
          weightKg: toKg(weight, next.settings.unit),
          reps,
          createdAt: new Date().toISOString(),
        });
      }
    });
    modal = null;
    render();
    toast(
      pr
        ? "NEW PR — nouveau record personnel !"
        : id
          ? "Série modifiée."
          : "Série ajoutée.",
      pr ? "pr" : "",
    );
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}
async function deleteExercise() {
  const exercise = data.exercises.find((item) => item.id === modal.id);
  if (
    !confirm(
      `Supprimer « ${exercise.name} » et toutes ses séries ? Cette action est définitive.`,
    )
  )
    return;
  setBusy(true);
  await mutate((next) => {
    next.exercises = next.exercises.filter((item) => item.id !== exercise.id);
    next.sets = next.sets.filter((set) => set.exerciseId !== exercise.id);
  });
  modal = null;
  selectedId = null;
  view = "home";
  render();
  toast("Exercice supprimé.");
}
async function deleteSet() {
  if (!confirm("Supprimer cette série ?")) return;
  const id = modal.id;
  setBusy(true);
  await mutate((next) => {
    next.sets = next.sets.filter((set) => set.id !== id);
  });
  modal = null;
  render();
  toast("Série supprimée.");
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal) closeModal();
});
async function start() {
  try {
    const stored = await loadData();
    if (stored) data = validateData(stored);
    handle = await loadHandle().catch(() => null);
    view = "welcome";
    render();
  } catch (error) {
    render();
    showError(error);
  }
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("./sw.js").catch(() => {});
}
start();
