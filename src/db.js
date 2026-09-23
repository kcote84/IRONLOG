const DB_NAME = "ironlog-v1";
const DB_VERSION = 1;
let openPromise;

function database() {
  if (!("indexedDB" in globalThis))
    return Promise.reject(
      new Error("Stockage local indisponible sur cet appareil."),
    );
  if (!openPromise)
    openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("state"))
          db.createObjectStore("state");
        if (!db.objectStoreNames.contains("handles"))
          db.createObjectStore("handles");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("Fermez les autres fenêtres IRONLOG, puis réessayez."),
        );
    }).catch((error) => {
      openPromise = null;
      throw error;
    });
  return openPromise;
}

async function transact(store, mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () =>
      reject(tx.error || new Error("Échec de l’enregistrement local."));
    tx.onabort = () =>
      reject(tx.error || new Error("Enregistrement local interrompu."));
  });
}

export const loadData = () =>
  transact("state", "readonly", (store) => store.get("main"));
export const saveData = (data) =>
  transact("state", "readwrite", (store) => store.put(data, "main"));
export const loadHandle = () =>
  transact("handles", "readonly", (store) => store.get("file"));
export const saveHandle = (handle) =>
  transact("handles", "readwrite", (store) => store.put(handle, "file"));
export const clearHandle = () =>
  transact("handles", "readwrite", (store) => store.delete("file"));
