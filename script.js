const romInput = document.getElementById("romInput");
const info = document.getElementById("info");
const playButton = document.getElementById("playButton");
const emulatorFrame = document.getElementById("emulatorFrame");

let selectedFile = null;
let selectedCore = null;
let romUrl = null;

const coreByExtension = {
  gba: "gba",
  gb: "gb",
  gbc: "gb",
  nes: "nes",
  sfc: "snes",
  smc: "snes",
  nds: "nds"
};

romInput.addEventListener("change", () => {
  const file = romInput.files[0];

  if (!file) {
    resetSelection();
    return;
  }

  const extension = getExtension(file.name);
  const core = coreByExtension[extension];

  if (!core) {
    resetSelection();
    info.innerHTML = `
      ❌ Arquivo não suportado.<br>
      Formatos aceitos: .gba, .gb, .gbc, .nes, .sfc, .smc, .nds
    `;
    return;
  }

  selectedFile = file;
  selectedCore = core;

  info.innerHTML = `
    ✅ ROM detectada:<br>
    <strong>${file.name}</strong><br><br>
    Sistema sugerido:<br>
    <strong>${core.toUpperCase()}</strong>
  `;

  playButton.disabled = false;
});

playButton.addEventListener("click", () => {
  if (!selectedFile || !selectedCore) return;

  if (romUrl) {
    URL.revokeObjectURL(romUrl);
  }

  romUrl = URL.createObjectURL(selectedFile);

  const emulatorHtml = createEmulatorHtml({
    gameUrl: romUrl,
    core: selectedCore,
    gameName: selectedFile.name
  });

  emulatorFrame.srcdoc = emulatorHtml;
});

function getExtension(fileName) {
  return fileName.split(".").pop().toLowerCase();
}

function resetSelection() {
  selectedFile = null;
  selectedCore = null;
  playButton.disabled = true;
  info.textContent = "Nenhuma ROM carregada.";
}

function createEmulatorHtml({ gameUrl, core, gameName }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: black;
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
        window.EJS_core = "${core}";
        window.EJS_gameName = "${escapeText(gameName)}";
        window.EJS_gameUrl = "${gameUrl}";
        window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
        window.EJS_startOnLoaded = true;
        window.EJS_color = "#ff7a00";
      <\/script>

      <script src="https://cdn.emulatorjs.org/stable/data/loader.js"><\/script>
    </body>
    </html>
  `;
}

function escapeText(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'");
}