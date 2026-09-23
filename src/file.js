import { MAX_FILE_BYTES, validateData } from "./model.js";

export async function readIronlog(file) {
  if (!file || file.size > MAX_FILE_BYTES)
    throw new Error("Fichier absent ou trop volumineux (40 Mo maximum).");
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("Le fichier est illisible ou endommagé.");
  }
  return validateData(parsed);
}

export function fileBlob(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  if (blob.size > MAX_FILE_BYTES)
    throw new Error("Fichier trop volumineux. Réduisez le nombre de photos.");
  return blob;
}
export function fileName(date = new Date()) {
  return `IRONLOG-${date.toISOString().slice(0, 10)}.ironlog`;
}
export async function chooseSaveHandle() {
  if (typeof globalThis.showSaveFilePicker !== "function") return null;
  return showSaveFilePicker({
    suggestedName: "IRONLOG.ironlog",
    types: [
      {
        description: "Fichier IRONLOG",
        accept: { "application/json": [".ironlog"] },
      },
    ],
  });
}
export async function writeHandle(handle, data) {
  const permission = await handle.queryPermission?.({ mode: "readwrite" });
  if (permission !== "granted") {
    const granted = await handle.requestPermission?.({ mode: "readwrite" });
    if (granted !== "granted")
      throw new Error(
        "Permission refusée. Votre séance reste enregistrée sur cet appareil.",
      );
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(fileBlob(data));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => {});
    throw error;
  }
}
export function downloadFile(data, name = fileName()) {
  const url = URL.createObjectURL(fileBlob(data));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
