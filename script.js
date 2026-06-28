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

const compressedExtensions = ["7z", "zip", "rar", "tar", "gz"];

const threeDSExtensions = [
  "3ds",
  "3dz",
  "cci",
  "cxi",
  "cia",
  "app",
  "ncch",
  "3dsx",
  "elf",
  "axf",
  "zcci",
  "zcxi",
  "z3dsx",
  "zcia"
];

const systemsByExtension = {
  gb: makeSystem("gb", "Game Boy", "GB", "gb", false),
  gbc: makeSystem("gb", "Game Boy Color", "GBC", "gb", false),
  gba: makeSystem("gba", "Game Boy Advance", "GBA", "gba", false),

  nds: makeSystem("nds", "Nintendo DS", "DS", "nds", false),
  dsi: makeSystem("nds", "Nintendo DS", "DS", "nds", false),

  z64: makeSystem("n64", "Nintendo 64", "N64", "n64", false),
  n64: makeSystem("n64", "Nintendo 64", "N64", "n64", false),
  v64: makeSystem("n64", "Nintendo 64", "N64", "n64", false),

  nes: makeSystem("nes", "NES", "NES", "nes", false),

  sfc: makeSystem("snes", "Super Nintendo", "SNES", "snes", false),
  smc: makeSystem("snes", "Super Nintendo", "SNES", "snes", false),

  cue: makeSystem("psx", "PlayStation", "PS1", "psx", false),
  bin: makeSystem("psx", "PlayStation", "PS1", "psx", false),
  iso: makeSystem("psx", "PlayStation", "PS1", "psx", false)
};

for (const ext of threeDSExtensions) {
  systemsByExtension[ext] = makeSystem("azahar", "Nintendo 3DS", "3DS", "3ds", true);
}

initApp();

if (romInput) {
  romInput.accept = [
    ".gb",
    ".gbc",
    ".gba",
    ".nds",
    ".dsi",
    ".3ds",
    ".3dz",
    ".cci",
    ".cxi",
    ".cia",
    ".app",
    ".ncch",
    ".3dsx",
    ".elf",
    ".axf",
    ".zcci",
    ".zcxi",
    ".z3dsx",
    ".zcia",
    ".z64",
    ".n64",
    ".v64",
    ".nes",
    ".sfc",
    ".smc",
    ".cue",
    ".bin",
    ".iso"
  ].join(",");

  romInput.addEventListener("change", async () => {
    const file = romInput.files[0];

    if (!file) {
      showMessage("Seus arquivos nunca são enviados. Tudo fica no navegador.");
      return;
    }

    await handleRomFile(file, { askToSave: true });
  });
}

if (uploadZone) {
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

  uploadZone.addEventListener("drop", async (event) => {
    event.preventDefault();

    const card = document.querySelector(".upload-card");

    if (card) {
      card.classList.remove("dragover");
    }

    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    await handleRomFile(file, { askToSave: true });
  });
}

if (acceptStorage) {
  acceptStorage.addEventListener("click", async () => {
    localStorage.setItem(CONSENT_KEY, "accepted");

    if (cookieBanner) {
      cookieBanner.classList.remove("show");
    }

    showMessage("Armazenamento local aceito. Agora você pode salvar ROMs.");
    await renderSavedRoms();
  });
}

if (declineStorage) {
  declineStorage.addEventListener("click", async () => {
    localStorage.setItem(CONSENT_KEY, "declined");

    if (cookieBanner) {
      cookieBanner.classList.remove("show");
    }

    showMessage("Armazenamento local recusado. Você ainda pode jogar sem salvar.");
    await renderSavedRoms();
  });
}

if (saveRomYes) {
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
}

if (saveRomNo) {
  saveRomNo.addEventListener("click", () => {
    closeSaveModal();
  });
}

function makeSystem(core, name, short, control, needsThreads) {
  return {
    core,
    name,
    short,
    control,
    needsThreads
  };
}

async function initApp() {
  const consent = getStorageConsent();

  if (!consent && cookieBanner) {
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

  const system = systemsByExtension[extension];

  if (!system) {
    showMessage("Arquivo não suportado. Use GB, GBC, GBA, NDS, 3DS, N64, NES, SNES ou PS1.");
    return;
  }

  const is3DS = system.core === "azahar";

  if (is3DS) {
    showMessage(`ROM 3DS detectada: ${file.name}. Enviando como File direto...`);
  }

  try {
    await startGame(file, system);
  } catch (error) {
    console.error(error);
    showMessage("Não foi possível carregar a ROM. Tenta outro arquivo.");
    return;
  }

  if (options.askToSave && getStorageConsent() === "accepted" && !is3DS) {
    const alreadySaved = await isRomSaved(file);

    if (!alreadySaved) {
      openSaveModal(file, system);
    }
  }

  if (is3DS) {
    showMessage(`ROM detectada: ${file.name} · Nintendo 3DS experimental. Pode demorar bastante.`);
  }
}

async function startGame(file, system) {
  const is3DS = system.core === "azahar";

  if (romUrl) {
    URL.revokeObjectURL(romUrl);
    romUrl = null;
  }

  let gameUrl = "";
  let gameFile = null;

  if (is3DS) {
    gameFile = file;
  } else {
    romUrl = URL.createObjectURL(file);
    gameUrl = romUrl;
  }

  openEmulator({
    gameUrl,
    gameFile,
    core: system.core,
    gameName: file.name,
    control: system.control,
    systemName: system.name,
    needsThreads: system.needsThreads
  });

  if (emulatorHolder) {
    emulatorHolder.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

function openEmulator({ gameUrl, gameFile, core, gameName, control, systemName, needsThreads }) {
  if (!emulatorHolder) {
    showMessage("Erro: emulatorHolder não existe no HTML.");
    return;
  }

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

  const useFileMode = Boolean(gameFile);

  iframe.srcdoc = createEmulatorHtml({
    gameUrl,
    core,
    gameName,
    control,
    systemName,
    needsThreads,
    useFileMode
  });

  let fileToSend = gameFile;
  let romSent = false;

  function sendRomToIframe() {
    if (romSent || !fileToSend || !iframe.contentWindow) {
      return;
    }

    romSent = true;

    console.log("Enviando 3DS como File direto:", fileToSend.name, fileToSend.size);

    iframe.contentWindow.postMessage(
      {
        type: "EJS_ROM_FILE",
        fileName: gameName,
        file: fileToSend
      },
      "*"
    );

    fileToSend = null;
    window.removeEventListener("message", readyHandler);
  }

  function readyHandler(event) {
    if (event.source !== iframe.contentWindow) {
      return;
    }

    if (!event.data || event.data.type !== "EJS_IFRAME_READY") {
      return;
    }

    sendRomToIframe();
  }

  if (useFileMode) {
    window.addEventListener("message", readyHandler);

    iframe.addEventListener(
      "load",
      () => {
        setTimeout(sendRomToIframe, 250);
      },
      { once: true }
    );

    setTimeout(sendRomToIframe, 1500);
  }

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
  if (!emulatorHolder) {
    return;
  }

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

function createEmulatorHtml({ gameUrl, core, gameName, control, systemName, needsThreads, useFileMode }) {
  const safeCore = safeJs(core);
  const safeGameName = safeJs(gameName);
  const safeGameUrl = safeJs(gameUrl);
  const safeControl = safeJs(control || core);
  const safeSystemName = safeJs(systemName || core);

  const threadsValue = needsThreads ? "true" : "false";
  const is3DS = core === "azahar" ? "true" : "false";
  const fileModeValue = useFileMode ? "true" : "false";

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
        const is3DS = ${is3DS};
        const useFileMode = ${fileModeValue};
        const systemName = "${safeSystemName}";
        const coreName = "${safeCore}";
        const notice = document.getElementById("notice");

        function showNotice(message) {
          notice.innerHTML = message;
          notice.style.display = "block";
        }

        function loadEmulatorLoader() {
          if (window.__EJS_loaderStarted) {
            return;
          }

          window.__EJS_loaderStarted = true;

          const loader = document.createElement("script");
          loader.src = "/data/loader.js";

          loader.onerror = function() {
            showNotice(
              "<strong>Erro no loader.</strong><br>" +
              "Não consegui carregar /data/loader.js."
            );
          };

          document.body.appendChild(loader);
        }

        window.addEventListener("error", function(event) {
          console.error(event.error || event.message);

          if (is3DS) {
            showNotice(
              "<strong>3DS deu erro.</strong><br>" +
              "A ROM pode estar criptografada, pesada demais ou incompatível com o core do navegador."
            );
          }
        });

        window.addEventListener("unhandledrejection", function(event) {
          console.error(event.reason);

          if (is3DS) {
            showNotice(
              "<strong>3DS não iniciou.</strong><br>" +
              "Use arquivo 3DS descriptografado. Tenta .cci primeiro."
            );
          }
        });

        window.EJS_player = "#game";
        window.EJS_core = coreName;
        window.EJS_gameName = "${safeGameName}";
        window.EJS_pathtodata = "/data/";
        window.EJS_startOnLoaded = true;
        window.EJS_color = "#ff9da9";
        window.EJS_backgroundColor = "#000000";
        window.EJS_controlScheme = "${safeControl}";
        window.EJS_volume = 0.7;

        window.EJS_forceLegacyCores = false;

        window.EJS_cacheConfig = {
          enabled: false,
          cacheMaxSizeMB: 0,
          cacheMaxAgeMins: 0
        };

        window.EJS_CacheLimit = 0;
        window.EJS_disableLocalStorage = is3DS;
        window.EJS_disableDatabases = is3DS;

        if (needsThreads) {
          window.EJS_threads = true;
        }

        if (is3DS) {
          setTimeout(function() {
            if (typeof SharedArrayBuffer === "undefined") {
              showNotice(
                "<strong>Aviso do 3DS:</strong><br>" +
                "SharedArrayBuffer está bloqueado. Confere o _headers."
              );
            }
          }, 700);
        }

        if (useFileMode) {
          showNotice(
            "<strong>Preparando 3DS...</strong><br>" +
            "Mandando a ROM como File direto, sem ler 2 GB na RAM."
          );

          window.addEventListener("message", function receiveRom(event) {
            if (!event.data || event.data.type !== "EJS_ROM_FILE") {
              return;
            }

            window.removeEventListener("message", receiveRom);

            try {
              const file = event.data.file;

              if (!file) {
                throw new Error("Arquivo não recebido.");
              }

              window.EJS_gameName = file.name || "${safeGameName}";
              window.EJS_gameUrl = file;

              console.log("3DS File recebido:", file.name, file.size);

              notice.style.display = "none";

              loadEmulatorLoader();
            } catch (error) {
              console.error(error);

              showNotice(
                "<strong>Erro ao receber a ROM.</strong><br>" +
                "O navegador não conseguiu passar o arquivo pro emulador."
              );
            }
          });

          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: "EJS_IFRAME_READY"
              },
              "*"
            );
          }

          setTimeout(function() {
            if (!window.__EJS_loaderStarted) {
              showNotice(
                "<strong>Esperando a ROM...</strong><br>" +
                "Se travar aqui, recarrega e escolhe a ROM de novo."
              );
            }
          }, 5000);
        } else {
          window.EJS_gameUrl = "${safeGameUrl}";
          loadEmulatorLoader();
        }
      <\/script>
    </body>
    </html>
  `;
}

function openSaveModal(file, system) {
  if (!saveRomModal || !saveRomName || !saveRomSize) {
    return;
  }

  pendingSave = { file, system };
  saveRomName.textContent = file.name;
  saveRomSize.textContent = `${system.name} · ${formatBytes(file.size)}`;
  saveRomModal.classList.remove("hidden");
}

function closeSaveModal() {
  pendingSave = null;

  if (saveRomModal) {
    saveRomModal.classList.add("hidden");
  }
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
  if (!savesList || !savesEmpty) {
    return;
  }

  savesList.innerHTML = "";

  if (getStorageConsent() !== "accepted") {
    savesEmpty.style.display = "grid";

    const strong = savesEmpty.querySelector("strong");
    const small = savesEmpty.querySelector("small");

    if (strong) {
      strong.textContent = "Armazenamento local não aceito";
    }

    if (small) {
      small.textContent = "Aceite o armazenamento local para salvar ROMs.";
    }

    return;
  }

  let records = [];

  try {
    records = await getAllSavedRoms();
  } catch (error) {
    console.error(error);
    savesEmpty.style.display = "grid";

    const strong = savesEmpty.querySelector("strong");
    const small = savesEmpty.querySelector("small");

    if (strong) {
      strong.textContent = "Não foi possível carregar os saves";
    }

    if (small) {
      small.textContent = "Seu navegador pode estar bloqueando IndexedDB.";
    }

    return;
  }

  if (records.length === 0) {
    savesEmpty.style.display = "grid";

    const strong = savesEmpty.querySelector("strong");
    const small = savesEmpty.querySelector("small");

    if (strong) {
      strong.textContent = "Nenhuma ROM salva ainda";
    }

    if (small) {
      small.textContent = "Envie uma ROM e clique em salvar localmente.";
    }

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

    let fixedCore = record.core;

    if (fixedCore === "3ds") {
      fixedCore = "azahar";
    }

    const system = {
      core: fixedCore,
      name: record.systemName,
      short: record.short,
      control: record.control,
      needsThreads: record.needsThreads || fixedCore === "azahar"
    };

    const file = new File([record.file], record.name, {
      type: record.type || "application/octet-stream",
      lastModified: record.lastModified || Date.now()
    });

    await startGame(file, system);
  } catch (error) {
    console.error(error);
    showMessage("Não foi possível abrir a ROM salva.");
  }
}

function getExtension(fileName) {
  return String(fileName).split(".").pop().toLowerCase().trim();
}

function showMessage(message) {
  if (fileInfo) {
    fileInfo.textContent = message;
  }
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
  if (uploadZone) {
    uploadZone.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

function scrollToSaves() {
  const savesPanel = document.getElementById("savesPanel");

  if (savesPanel) {
    savesPanel.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

window.scrollToUpload = scrollToUpload;
window.scrollToSaves = scrollToSaves;

window.addEventListener("resize", () => {
  const iframe = emulatorHolder ? emulatorHolder.querySelector(".emulator-frame") : null;

  if (iframe && !window.PlayerModeController) {
    forceSmallPlayerScreen();
  }
});
