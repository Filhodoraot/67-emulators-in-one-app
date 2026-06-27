const romInput = document.getElementById("romInput");
const uploadZone = document.getElementById("uploadZone");
const fileInfo = document.getElementById("fileInfo");
const emulatorHolder = document.getElementById("emulatorHolder");

const cookieBanner = document.getElementById("cookieBanner");
const acceptStorage = document.getElementById("acceptStorage");
const declineStorage = document.getElementById("declineStorage");

const saveRomModal = document.getElementById("saveRomModal");
const saveRomName = document.getElementById("saveRomName");
const saveRomSize = document.getElementById("saveRomSize");
const saveRomYes = document.getElementById("saveRomYes");
const saveRomNo = document.getElementById("saveRomNo");

const savesList = document.getElementById("savesList");
const savesEmpty = document.getElementById("savesEmpty");

const DB_NAME = "sixtySevenEmulatorsDB";
const DB_VERSION = 1;
const ROM_STORE = "roms";
const CONSENT_KEY = "sixtySevenEmulatorsStorageConsent";

let romUrl = null;
let pendingSave = null;

const systemsByExtension = {
  gb: { core: "gb", name: "Game Boy", short: "GB", control: "gb" },
  gbc: { core: "gb", name: "Game Boy Color", short: "GBC", control: "gb" },
  gba: { core: "gba", name: "Game Boy Advance", short: "GBA", control: "gba" },
  nds: { core: "nds", name: "Nintendo DS", short: "DS", control: "nds" },

  "3ds": { core: "3ds", name: "Nintendo 3DS", short: "3DS", control: "3ds" },
  cci: { core: "3ds", name: "Nintendo 3DS", short: "3DS", control: "3ds" },
  cxi: { core: "3ds", name: "Nintendo 3DS", short: "3DS", control: "3ds" },

  z64: { core: "mupen64plus_next", name: "Nintendo 64", short: "N64", control: "n64" },
  n64: { core: "mupen64plus_next", name: "Nintendo 64", short: "N64", control: "n64" },
  v64: { core: "mupen64plus_next", name: "Nintendo 64", short: "N64", control: "n64" },

  nes: { core: "nes", name: "NES", short: "NES", control: "nes" },
  sfc: { core: "snes", name: "Super Nintendo", short: "SNES", control: "snes" },
  smc: { core: "snes", name: "Super Nintendo", short: "SNES", control: "snes" },

  cue: { core: "psx", name: "PlayStation", short: "PS1", control: "psx" },
  bin: { core: "psx", name: "PlayStation", short: "PS1", control: "psx" },
  iso: { core: "psx", name: "PlayStation", short: "PS1", control: "psx" }
};

initApp();

romInput.addEventListener("change", () => {
  const file = romInput.files[0];

  if (!file) {
    showMessage("Seus arquivos nunca são enviados. Tudo fica no navegador.");
    return;
  }

  handleRomFile(file, { askToSave: true });
});

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();

  const card = document.querySelector(".upload-card");
  card.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
  const card = document.querySelector(".upload-card");
  card.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();

  const card = document.querySelector(".upload-card");
  card.classList.remove("dragover");

  const file = event.dataTransfer.files[0];

  if (!file) {
    return;
  }

  handleRomFile(file, { askToSave: true });
});

acceptStorage.addEventListener("click", async () => {
  localStorage.setItem(CONSENT_KEY, "accepted");
  cookieBanner.classList.remove("show");
  showMessage("Armazenamento local aceito. Agora você pode salvar ROMs.");
  await renderSavedRoms();
});

declineStorage.addEventListener("click", async () => {
  localStorage.setItem(CONSENT_KEY, "declined");
  cookieBanner.classList.remove("show");
  showMessage("Armazenamento local recusado. Você ainda pode jogar sem salvar.");
  await renderSavedRoms();
});

saveRomYes.addEventListener("click", async () => {
  if (!pendingSave) {
    closeSaveModal();
    return;
  }

  try {
    await saveRomToDB(pendingSave.file, pendingSave.system);
    showMessage(`ROM salva: ${pendingSave.file.name}`);
    await renderSavedRoms();
  } catch (error) {
    console.error(error);

    if (error.name === "QuotaExceededError") {
      showMessage("Sem espaço suficiente no navegador para salvar esta ROM.");
    } else {
      showMessage("Não foi possível salvar esta ROM.");
    }
  }

  closeSaveModal();
});

saveRomNo.addEventListener("click", () => {
  closeSaveModal();
});

async function initApp() {
  const consent = getStorageConsent();

  if (!consent) {
    cookieBanner.classList.add("show");
  }

  await renderSavedRoms();
}

async function handleRomFile(file, options = {}) {
  const extension = getExtension(file.name);
  const system = systemsByExtension[extension];

  if (!system) {
    showMessage("Arquivo não suportado. Use GB, GBC, GBA, NDS, 3DS, N64, NES, SNES ou PS1.");
    return;
  }

  startGame(file, system);

  if (options.askToSave && getStorageConsent() === "accepted") {
    const alreadySaved = await isRomSaved(file);

    if (!alreadySaved) {
      openSaveModal(file, system);
    }
  }
}

function startGame(file, system) {
  if (romUrl) {
    URL.revokeObjectURL(romUrl);
  }

  romUrl = URL.createObjectURL(file);

  showMessage(`ROM detectada: ${file.name} · ${system.name}`);

  openEmulator({
    gameUrl: romUrl,
    core: system.core,
    gameName: file.name,
    control: system.control
  });

  emulatorHolder.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function openEmulator({ gameUrl, core, gameName, control }) {
  emulatorHolder.innerHTML = "";

  const iframe = document.createElement("iframe");
  iframe.className = "emulator-frame";
  iframe.title = "Emulator Player";
  iframe.srcdoc = createEmulatorHtml({
    gameUrl,
    core,
    gameName,
    control
  });

  emulatorHolder.appendChild(iframe);
}

function createEmulatorHtml({ gameUrl, core, gameName, control }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: #000;
          overflow: hidden;
        }

        #game {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <div id="game"></div>

      <script>
        window.EJS_player = "#game";
        window.EJS_core = "${safeJs(core)}";
        window.EJS_gameName = "${safeJs(gameName)}";
        window.EJS_gameUrl = "${safeJs(gameUrl)}";
        window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
        window.EJS_startOnLoaded = true;
        window.EJS_color = "#ff9da9";
        window.EJS_backgroundColor = "#090909";
        window.EJS_controlScheme = "${safeJs(control || "n64")}";
      <\/script>

      <script src="https://cdn.emulatorjs.org/stable/data/loader.js"><\/script>
    </body>
    </html>
  `;
}

function openSaveModal(file, system) {
  pendingSave = { file, system };
  saveRomName.textContent = file.name;
  saveRomSize.textContent = `${system.name} · ${formatBytes(file.size)}`;
  saveRomModal.classList.remove("hidden");
}

function closeSaveModal() {
  pendingSave = null;
  saveRomModal.classList.add("hidden");
}

function getStorageConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

function getRomId(file) {
  return `${file.name}__${file.size}__${file.lastModified || 0}`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ROM_STORE)) {
        const store = db.createObjectStore(ROM_STORE, { keyPath: "id" });

        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
}

async function saveRomToDB(file, system) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ROM_STORE, "readwrite");
    const store = transaction.objectStore(ROM_STORE);

    const record = {
      id: getRomId(file),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || Date.now(),
      extension: getExtension(file.name),
      core: system.core,
      systemName: system.name,
      short: system.short,
      control: system.control,
      file,
      savedAt: Date.now()
    };

    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(record);

    transaction.oncomplete = () => db.close();
  });
}

async function getAllSavedRoms() {
  if (getStorageConsent() !== "accepted") {
    return [];
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ROM_STORE, "readonly");
    const store = transaction.objectStore(ROM_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const records = request.result || [];
      records.sort((a, b) => b.savedAt - a.savedAt);
      resolve(records);
    };

    transaction.oncomplete = () => db.close();
  });
}

async function getSavedRom(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ROM_STORE, "readonly");
    const store = transaction.objectStore(ROM_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    transaction.oncomplete = () => db.close();
  });
}

async function deleteSavedRom(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ROM_STORE, "readwrite");
    const store = transaction.objectStore(ROM_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

async function isRomSaved(file) {
  if (getStorageConsent() !== "accepted") {
    return false;
  }

  const record = await getSavedRom(getRomId(file));
  return Boolean(record);
}

async function renderSavedRoms() {
  savesList.innerHTML = "";

  if (getStorageConsent() !== "accepted") {
    savesEmpty.style.display = "grid";
    savesEmpty.querySelector("strong").textContent = "Armazenamento local não aceito";
    savesEmpty.querySelector("small").textContent = "Aceite o armazenamento local para salvar ROMs.";
    return;
  }

  let records = [];

  try {
    records = await getAllSavedRoms();
  } catch (error) {
    console.error(error);
    savesEmpty.style.display = "grid";
    savesEmpty.querySelector("strong").textContent = "Não foi possível carregar os saves";
    savesEmpty.querySelector("small").textContent = "Seu navegador pode estar bloqueando IndexedDB.";
    return;
  }

  if (records.length === 0) {
    savesEmpty.style.display = "grid";
    savesEmpty.querySelector("strong").textContent = "Nenhuma ROM salva ainda";
    savesEmpty.querySelector("small").textContent = "Envie uma ROM e clique em salvar localmente.";
    return;
  }

  savesEmpty.style.display = "none";

  for (const record of records) {
    const item = document.createElement("div");
    item.className = "save-item";

    const info = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = record.name;

    const details = document.createElement("small");
    details.textContent = `${record.systemName} · ${formatBytes(record.size)}`;

    info.appendChild(title);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "save-actions";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Jogar";
    playButton.addEventListener("click", async () => {
      await playSavedRom(record.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.className = "delete";
    deleteButton.addEventListener("click", async () => {
      await deleteSavedRom(record.id);
      await renderSavedRoms();
      showMessage(`ROM excluída: ${record.name}`);
    });

    actions.appendChild(playButton);
    actions.appendChild(deleteButton);

    item.appendChild(info);
    item.appendChild(actions);

    savesList.appendChild(item);
  }
}

async function playSavedRom(id) {
  try {
    const record = await getSavedRom(id);

    if (!record) {
      showMessage("ROM salva não encontrada.");
      await renderSavedRoms();
      return;
    }

    const system = {
      core: record.core,
      name: record.systemName,
      short: record.short,
      control: record.control
    };

    const file = new File([record.file], record.name, {
      type: record.type || "application/octet-stream",
      lastModified: record.lastModified || Date.now()
    });

    startGame(file, system);
  } catch (error) {
    console.error(error);
    showMessage("Não foi possível abrir a ROM salva.");
  }
}

function getExtension(fileName) {
  return fileName.split(".").pop().toLowerCase().trim();
}

function showMessage(message) {
  fileInfo.textContent = message;
}

function safeJs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'")
    .replaceAll("\n", " ");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function scrollToUpload() {
  uploadZone.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function scrollToSaves() {
  document.getElementById("savesPanel").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}
