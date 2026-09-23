export const FORMAT = "IRONLOG";
export const FORMAT_VERSION = 1;
export const MAX_EXERCISES = 1000;
export const MAX_SETS = 20000;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export function freshData() {
  const now = new Date().toISOString();
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: { unit: "lb" },
    exercises: [],
    workouts: [],
    sets: [],
    activeWorkoutId: null,
  };
}

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function validateData(value) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.format !== FORMAT
  )
    fail("Ce fichier n’est pas un fichier IRONLOG.");
  if (value.version !== FORMAT_VERSION)
    fail(
      value.version > FORMAT_VERSION
        ? "Ce fichier provient d’une version plus récente d’IRONLOG."
        : "Version de fichier non prise en charge.",
    );
  if (!validDate(value.createdAt) || !validDate(value.updatedAt))
    fail("Dates du fichier invalides.");
  if (!value.settings || !["lb", "kg"].includes(value.settings.unit))
    fail("Réglages du fichier invalides.");
  if (
    !Array.isArray(value.exercises) ||
    !Array.isArray(value.workouts) ||
    !Array.isArray(value.sets)
  )
    fail("Contenu du fichier incomplet.");
  if (
    value.exercises.length > MAX_EXERCISES ||
    value.sets.length > MAX_SETS ||
    value.workouts.length > MAX_SETS
  )
    fail("Fichier trop volumineux.");
  const ids = (items) => new Set(items.map((item) => item.id));
  const validId = (id) =>
    typeof id === "string" && id.length > 0 && id.length <= 100;
  for (const exercise of value.exercises) {
    if (
      !validId(exercise.id) ||
      typeof exercise.name !== "string" ||
      !exercise.name.trim() ||
      exercise.name.length > 100 ||
      (exercise.photo !== null &&
        exercise.photo !== undefined &&
        (typeof exercise.photo !== "string" ||
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
            exercise.photo,
          ) ||
          exercise.photo.length > 1000000)) ||
      !validDate(exercise.createdAt)
    )
      fail("Un exercice du fichier est invalide.");
  }
  if (
    value.exercises.reduce(
      (total, exercise) => total + (exercise.photo?.length || 0),
      0,
    ) >
    28 * 1024 * 1024
  )
    fail("Trop de photos pour un fichier portable.");
  for (const workout of value.workouts) {
    if (
      !validId(workout.id) ||
      !validDate(workout.startedAt) ||
      (workout.endedAt !== null && !validDate(workout.endedAt))
    )
      fail("Une séance du fichier est invalide.");
  }
  for (const set of value.sets) {
    if (
      !validId(set.id) ||
      !validId(set.exerciseId) ||
      !validId(set.workoutId) ||
      !Number.isFinite(set.weightKg) ||
      set.weightKg < 0 ||
      set.weightKg > 2000 ||
      !Number.isInteger(set.reps) ||
      set.reps < 1 ||
      set.reps > 1000 ||
      !validDate(set.createdAt)
    )
      fail("Une série du fichier est invalide.");
  }
  for (const items of [value.exercises, value.workouts, value.sets])
    if (ids(items).size !== items.length)
      fail("Identifiants en double dans le fichier.");
  const exerciseIds = ids(value.exercises);
  const workoutIds = ids(value.workouts);
  if (
    value.sets.some(
      (set) =>
        !exerciseIds.has(set.exerciseId) || !workoutIds.has(set.workoutId),
    )
  )
    fail("Références de séries invalides.");
  if (
    value.activeWorkoutId !== null &&
    value.activeWorkoutId !== undefined &&
    !workoutIds.has(value.activeWorkoutId)
  )
    fail("Séance en cours invalide.");
  if (
    value.activeWorkoutId &&
    value.workouts.find((workout) => workout.id === value.activeWorkoutId)
      ?.endedAt
  )
    fail("Séance en cours déjà terminée.");
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    settings: { unit: value.settings.unit },
    exercises: value.exercises.map((x) => ({
      id: x.id,
      name: x.name.trim(),
      photo: x.photo || null,
      createdAt: x.createdAt,
    })),
    workouts: value.workouts.map((x) => ({
      id: x.id,
      startedAt: x.startedAt,
      endedAt: x.endedAt || null,
    })),
    sets: value.sets.map((x) => ({
      id: x.id,
      exerciseId: x.exerciseId,
      workoutId: x.workoutId,
      weightKg: x.weightKg,
      reps: x.reps,
      createdAt: x.createdAt,
    })),
    activeWorkoutId: value.activeWorkoutId || null,
  };
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
export function toKg(weight, unit) {
  return unit === "lb" ? weight / 2.2046226218 : weight;
}
export function fromKg(weightKg, unit) {
  return unit === "lb" ? weightKg * 2.2046226218 : weightKg;
}
export function displayWeight(weightKg, unit) {
  return Number(fromKg(weightKg, unit).toFixed(1)).toLocaleString("fr-CA", {
    maximumFractionDigits: 1,
  });
}
export function exerciseSets(data, exerciseId) {
  return data.sets
    .filter((set) => set.exerciseId === exerciseId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function bestSet(sets) {
  return (
    [...sets].sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0] ||
    null
  );
}
export function isPr(set, priorSets) {
  const best = bestSet(priorSets);
  return (
    !best ||
    set.weightKg > best.weightKg + 0.000001 ||
    (Math.abs(set.weightKg - best.weightKg) < 0.000001 && set.reps > best.reps)
  );
}
export function lastWorkoutSets(data, exerciseId) {
  const sets = exerciseSets(data, exerciseId);
  if (!sets.length) return [];
  const workoutId = sets[0].workoutId;
  return sets
    .filter((set) => set.workoutId === workoutId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
export function workoutGroups(data, exerciseId) {
  const grouped = new Map();
  for (const set of exerciseSets(data, exerciseId)) {
    if (!grouped.has(set.workoutId)) grouped.set(set.workoutId, []);
    grouped.get(set.workoutId).push(set);
  }
  return [...grouped]
    .map(([id, sets]) => ({
      workout: data.workouts.find((w) => w.id === id),
      sets: sets.sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      ),
    }))
    .sort(
      (a, b) =>
        Date.parse(b.workout.startedAt) - Date.parse(a.workout.startedAt),
    );
}
