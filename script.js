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

const compressedExtensions = ["7z", "zip", "rar"];

const systemsByExtension = {
  gb: {
    core: "gb",
    name: "Game Boy",
    short: "GB",
    control: "gb",
    needsThreads: false
  },

  gbc: {
    core: "gb",
    name: "Game Boy Color",
    short: "GBC",
    control: "gb",
    needsThreads: false
  },

  gba: {
    core: "gba",
    name: "Game Boy Advance",
    short: "GBA",
    control: "gba",
    needsThreads: false
  },

  nds: {
    core: "nds",
    name: "Nintendo DS",
    short: "DS",
    control: "nds",
    needsThreads: false
  },

  "3ds": {
    core: "3ds",
    name: "Nintendo 3DS",
    short: "3DS",
    control: "3ds",
    needsThreads: true
  },

  cci: {
    core: "3ds",
    name: "Nintendo 3DS",
    short: "3DS",
    control: "3ds",
    needsThreads: true
  },

  cxi: {
    core: "3ds",
    name: "Nintendo 3DS",
    short: "3DS",
    control: "3ds",
    needsThreads: true
  },

  z64: {
    core: "n64",
    name: "Nintendo 64",
    short: "N64",
    control: "n64",
    needsThreads: false
  },

  n64: {
    core: "n64",
    name: "Nintendo 64",
    short: "N64",
    control: "n64",
    needsThreads: false
  },

  v64: {
    core: "n64",
    name: "Nintendo 64",
    short: "N64",
    control: "n64",
    needsThreads: false
  },

  nes: {
    core: "nes",
    name: "NES",
    short: "NES",
    control: "nes",
    needsThreads: false
  },

  sfc: {
    core: "snes",
    name: "Super Nintendo",
    short: "SNES",
    control: "snes",
    needsThreads: false
  },

  smc: {
    core: "snes",
    name: "Super Nintendo",
    short: "SNES",
    control: "snes",
    needsThreads: false
  },

  cue: {
    core: "psx",
    name: "PlayStation",
    short: "PS1",
    control: "psx",
    needsThreads: false
  },

  bin: {
    core: "psx",
    name: "PlayStation",
    short: "PS1",
    control: "psx",
    needsThreads: false
  },

  iso: {
    core: "psx",
    name: "PlayStation",
    short: "PS1",
    control: "psx",
    needsThreads: false
  }
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

  if (card) {
    card.classList.add("dragover");
  }
});

uploadZone.addEventListener("dragleave", () => {
  const card = document.querySelector(".upload-card");

  if (card) {
    card.classList.remove("dragover");
  }
});

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();

  const card = document.querySelector(".upload-card");

  if (card) {
    card.classList.remove("dragover");
  }

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

  if (compressedExtensions.includes(extension)) {
    showMessage("Esse arquivo está compactado. Extraia primeiro e envie a ROM certa.");
    return;
  }

  if (extension === "cia") {
    showMessage("Arquivo .cia não é ideal no navegador. Use .3ds, .cci ou .cxi descriptografado.");
    return;
  }

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
    control: system.control,
    systemName: system.name,
    needsThreads: system.needsThreads
  });

  emulatorHolder.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function openEmulator({ gameUrl, core, gameName, control, systemName, needsThreads }) {
  emulatorHolder.innerHTML = "";

  const iframe = document.createElement("iframe");
  iframe.className = "emulator-frame";
  iframe.title = "Emulator Player";
  iframe.allow = "gamepad; fullscreen";
  iframe.setAttribute("allowfullscreen", "true");

  iframe.style.setProperty("width", "100%", "important");
  iframe.style.setProperty("height", getSmallPlayerHeight(), "important");
  iframe.style.setProperty("min-height", getSmallPlayerHeight(), "important");
  iframe.style.setProperty("border", "0", "important");
  iframe.style.setProperty("display", "block", "important");
  iframe.style.setProperty("background", "#000", "important");
  iframe.style.setProperty("border-radius", "18px", "important");

  iframe.srcdoc = createEmulatorHtml({
    gameUrl,
    core,
    gameName,
    control,
    systemName,
    needsThreads
  });

  emulatorHolder.appendChild(iframe);

  forceSmallPlayerScreen();

  setTimeout(() => {
    if (window.PlayerModeController) {
      window.PlayerModeController.setPlayerMode("small", false);
    } else {
      forceSmallPlayerScreen();
    }
  }, 80);
}

function forceSmallPlayerScreen() {
  const height = getSmallPlayerHeight();
  const previewCard = emulatorHolder.closest(".preview-card");
  const middleGrid = emulatorHolder.closest(".middle-grid");
  const systemsCard = middleGrid ? middleGrid.querySelector(".systems-card") : null;
  const iframe = emulatorHolder.querySelector(".emulator-frame");

  if (middleGrid) {
    middleGrid.style.setProperty("display", "grid", "important");
    middleGrid.style.setProperty("grid-template-columns", "0.95fr 1.05fr", "important");
    middleGrid.style.setProperty("gap", "16px", "important");
    middleGrid.style.setProperty("width", "min(1280px, calc(100% - 70px))", "important");
  }

  if (systemsCard) {
    systemsCard.style.setProperty("display", "block", "important");
  }

  if (previewCard) {
    previewCard.classList.add("is-playing");
    previewCard.style.setProperty("width", "100%", "important");
    previewCard.style.setProperty("height", height, "important");
    previewCard.style.setProperty("min-height", height, "important");
    previewCard.style.setProperty("max-height", "none", "important");
    previewCard.style.setProperty("overflow", "hidden", "important");
    previewCard.style.setProperty("padding", "0", "important");
    previewCard.style.setProperty("background", "#000", "important");
    previewCard.style.setProperty("border", "1px solid #3a3a3a", "important");
    previewCard.style.setProperty("border-radius", "18px", "important");
    previewCard.style.setProperty("box-shadow", "0 12px 40px rgba(0, 0, 0, 0.35)", "important");
  }

  emulatorHolder.style.setProperty("width", "100%", "important");
  emulatorHolder.style.setProperty("height", height, "important");
  emulatorHolder.style.setProperty("min-height", height, "important");
  emulatorHolder.style.setProperty("max-height", "none", "important");
  emulatorHolder.style.setProperty("overflow", "hidden", "important");
  emulatorHolder.style.setProperty("display", "block", "important");
  emulatorHolder.style.setProperty("background", "#000", "important");
  emulatorHolder.style.setProperty("border-radius", "18px", "important");
  emulatorHolder.style.setProperty("position", "relative", "important");

  if (iframe) {
    iframe.style.setProperty("width", "100%", "important");
    iframe.style.setProperty("height", height, "important");
    iframe.style.setProperty("min-height", height, "important");
    iframe.style.setProperty("max-height", "none", "important");
    iframe.style.setProperty("display", "block", "important");
    iframe.style.setProperty("border", "0", "important");
    iframe.style.setProperty("background", "#000", "important");
    iframe.style.setProperty("border-radius", "18px", "important");
  }
}

function getSmallPlayerHeight() {
  if (window.innerWidth <= 780) {
    return "330px";
  }

  return "420px";
}

function createEmulatorHtml({ gameUrl, core, gameName, control, systemName, needsThreads }) {
  const safeCore = safeJs(core);
  const safeGameName = safeJs(gameName);
  const safeGameUrl = safeJs(gameUrl);
  const safeControl = safeJs(control || core);
  const safeSystemName = safeJs(systemName || core);
  const threadsValue = needsThreads ? "true" : "false";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <style>
        html,
        body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: #000;
          overflow: hidden;
          font-family: Arial, Helvetica, sans-serif;
        }

        #game {
          width: 100%;
          height: 100%;
          background: #000;
        }

        #notice {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 999999;
          display: none;
          padding: 12px 14px;
          border: 1px solid #ff9da9;
          border-radius: 12px;
          color: #fff;
          background: rgba(10, 10, 10, 0.92);
          font-size: 13px;
          line-height: 1.35;
        }

        #notice strong {
          color: #ffb8c1;
        }
      </style>
    </head>

    <body>
      <div id="game"></div>
      <div id="notice"></div>

      <script>
        const needsThreads = ${threadsValue};
        const systemName = "${safeSystemName}";
        const notice = document.getElementById("notice");

        function showNotice(message) {
          notice.innerHTML = message;
          notice.style.display = "block";
        }

        window.addEventListener("error", function(event) {
          console.error(event.error || event.message);

          if (systemName === "Nintendo 3DS") {
            showNotice(
              "<strong>3DS deu erro.</strong><br>" +
              "Confira se a pasta data está no site e se a ROM está extraída e descriptografada."
            );
          }
        });

        window.addEventListener("unhandledrejection", function(event) {
          console.error(event.reason);

          if (systemName === "Nintendo 3DS") {
            showNotice(
              "<strong>3DS não iniciou.</strong><br>" +
              "Use .3ds, .cci ou .cxi extraído. Se for .cia, .7z ou criptografado, pode falhar."
            );
          }
        });

        window.EJS_player = "#game";
        window.EJS_core = "${safeCore}";
        window.EJS_gameName = "${safeGameName}";
        window.EJS_gameUrl = "${safeGameUrl}";
        window.EJS_pathtodata = "/data/";
        window.EJS_startOnLoaded = true;
        window.EJS_color = "#ff9da9";
        window.EJS_backgroundColor = "#000000";
        window.EJS_controlScheme = "${safeControl}";
        window.EJS_volume = 0.7;

        if (needsThreads) {
          window.EJS_threads = true;
        }

        if (systemName === "Nintendo 3DS") {
          setTimeout(function() {
            if (typeof SharedArrayBuffer === "undefined") {
              showNotice(
                "<strong>Aviso do 3DS:</strong><br>" +
                "SharedArrayBuffer ainda está bloqueado. Confira o netlify.toml e faça Clear cache and deploy."
              );
            }
          }, 700);
        }
      <\/script>

      <script src="/data/loader.js"><\/script>
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
      needsThreads: system.needsThreads,
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
      control: record.control,
      needsThreads: record.needsThreads || false
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
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
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

window.addEventListener("resize", () => {
  const iframe = emulatorHolder.querySelector(".emulator-frame");

  if (iframe && !window.PlayerModeController) {
    forceSmallPlayerScreen();
  }
});
