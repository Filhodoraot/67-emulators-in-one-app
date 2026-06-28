const ROMS = new Map();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "STORE_ROM") {
    const id = String(data.id || "");
    const file = data.file;

    if (!id || !file) {
      reply(event, {
        type: "ROM_STORED",
        ok: false,
        error: "ROM inválida."
      });

      return;
    }

    ROMS.clear();

    ROMS.set(id, {
      id,
      file,
      name: file.name || data.name || "game.3ds",
      size: file.size || 0,
      type: file.type || "application/octet-stream",
      createdAt: Date.now()
    });

    reply(event, {
      type: "ROM_STORED",
      ok: true,
      id,
      name: file.name || data.name || "game.3ds",
      size: file.size || 0
    });

    return;
  }

  if (data.type === "CLEAR_ROMS") {
    ROMS.clear();

    reply(event, {
      type: "ROMS_CLEARED",
      ok: true
    });
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith("/local-rom/")) {
    return;
  }

  event.respondWith(handleLocalRomRequest(event.request, url));
});

function reply(event, message) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(message);
    return;
  }

  if (event.source) {
    event.source.postMessage(message);
  }
}

async function handleLocalRomRequest(request, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  const id = decodeURIComponent(parts[1] || "");
  const entry = ROMS.get(id);

  if (!entry || !entry.file) {
    return new Response("ROM local não encontrada. Escolha o arquivo de novo.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cross-Origin-Resource-Policy": "cross-origin"
      }
    });
  }

  const file = entry.file;
  const size = file.size || 0;
  const type = file.type || "application/octet-stream";

  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": type,
    "Content-Disposition": `inline; filename="${safeHeaderFileName(entry.name)}"`,
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "cross-origin"
  };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(size)
      }
    });
  }

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);

    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    const chunk = file.slice(range.start, range.end + 1, type);
    const chunkSize = range.end - range.start + 1;

    return new Response(chunk, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`
      }
    });
  }

  return new Response(file, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(size)
    }
  });
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader || "");

  if (!match) {
    return null;
  }

  let startText = match[1];
  let endText = match[2];

  let start;
  let end;

  if (startText === "" && endText === "") {
    return null;
  }

  if (startText === "") {
    const suffixLength = Number.parseInt(endText, 10);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number.parseInt(startText, 10);
    end = endText === "" ? size - 1 : Number.parseInt(endText, 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  if (start < 0 || end < 0 || start > end || start >= size) {
    return null;
  }

  end = Math.min(end, size - 1);

  return {
    start,
    end
  };
}

function safeHeaderFileName(name) {
  return String(name || "game.3ds")
    .replaceAll("\\", "_")
    .replaceAll('"', "_")
    .replaceAll("\n", "_")
    .replaceAll("\r", "_");
}
