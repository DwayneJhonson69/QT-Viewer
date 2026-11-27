/**
 * src/localLoader.js
 * Client-side local file/folder loader & .unity3d header inspector for QT-Viewer.
 * Enables full offline & GitHub Pages usage without a backend server.
 */

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function readDroppedFiles(dataTransfer) {
  const files = [];
  const items = dataTransfer?.items;
  if (!items || items.length === 0) {
    return Array.from(dataTransfer?.files || []);
  }

  const walkEntry = async (entry) => {
    if (!entry) return;
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej));
      files.push(f);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => new Promise((res, rej) => reader.readEntries(res, rej));
      let batch = await readBatch();
      while (batch.length > 0) {
        for (const child of batch) {
          await walkEntry(child);
        }
        batch = await readBatch();
      }
    }
  };

  const entries = [];
  for (const item of items) {
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      await walkEntry(entry);
    }
    return files;
  }

  return Array.from(dataTransfer.files || []);
}

function readCString(bytes, offset, maxLen = 128) {
  let end = offset;
  while (end < bytes.length && end - offset < maxLen && bytes[end] !== 0) {
    end++;
  }
  const slice = bytes.slice(offset, end);
  return {
    text: new TextDecoder("ascii", { fatal: false }).decode(slice),
    nextOffset: end + 1
  };
}

/**
 * Inspects the binary header of a .unity3d / AssetBundle file in-browser.
 */
export async function inspectUnityBundleHeader(file) {
  const headerSlice = file.slice(0, 512);
  const buf = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const sig = readCString(bytes, 0, 32);
  const validSignatures = ["UnityFS", "UnityWeb", "UnityRaw", "UnityArchive"];
  const isUnityBundle = validSignatures.includes(sig.text);

  if (!isUnityBundle) {
    return {
      fileName: file.name,
      size: file.size,
      isUnityBundle: false,
      signature: sig.text || "Unknown"
    };
  }

  const view = new DataView(buf);
  const formatVersion = sig.nextOffset + 4 <= bytes.length ? view.getUint32(sig.nextOffset, false) : null;
  const playerVer = readCString(bytes, sig.nextOffset + 4, 64);
  const engineVer = readCString(bytes, playerVer.nextOffset, 64);

  return {
    fileName: file.name,
    size: file.size,
    isUnityBundle: true,
    signature: sig.text,
    formatVersion,
    unityVersion: playerVer.text || "Unknown",
    engineVersion: engineVer.text || "Unknown"
  };
}

function parseAtlasPageNames(atlasText) {
  const pages = [];
  const lines = atlasText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/\.(png|webp|jpg|jpeg)$/i.test(line) && !line.includes(":")) {
      pages.push(line);
    }
  }
  return pages;
}

/**
 * Packages dropped/selected local files into a SpinePlayer-compatible rawDataURIs bundle.
 */
export async function buildLocalSpineBundle(fileList) {
  const files = Array.from(fileList || []);
  const unityFiles = files.filter(f => /\.(unity3d|bundle)$/i.test(f.name));
  const unityBundles = [];
  for (const uf of unityFiles) {
    unityBundles.push(await inspectUnityBundleHeader(uf));
  }

  const skelBinary = files.find(f => /\.(skel|skel\.bytes|skel\.txt)$/i.test(f.name));
  const jsonCandidates = files.filter(f => /\.json$/i.test(f.name) && !/^(hierarchy|characters|scene_adjustments)\.json$/i.test(f.name));
  let skelJson = null;
  for (const jf of jsonCandidates) {
    try {
      const txt = await jf.slice(0, 4096).text();
      if (txt.includes('"skeleton"') || txt.includes('"bones"') || txt.includes('"animations"')) {
        skelJson = jf;
        break;
      }
    } catch (_) {}
  }

  const skelFile = skelBinary || skelJson;
  const atlasFile = files.find(f => /\.(atlas|atlas\.txt)$/i.test(f.name));
  const imageFiles = files.filter(f => /\.(png|webp|jpg|jpeg)$/i.test(f.name));
  const audioFiles = files.filter(f => /\.(mp3|wav|ogg)$/i.test(f.name));

  if (!skelFile || !atlasFile) {
    return {
      ready: false,
      unityBundles,
      hasSkel: !!skelFile,
      hasAtlas: !!atlasFile,
      imageCount: imageFiles.length,
      audioFiles
    };
  }

  const isJson = !skelBinary && !!skelJson;
  const skelKey = isJson ? "local/skeleton.json" : "local/skeleton.skel";
  const atlasKey = "local/skeleton.atlas";
  const rawDataURIs = {};

  rawDataURIs[skelKey] = await fileToDataUrl(skelFile);
  rawDataURIs[atlasKey] = await fileToDataUrl(atlasFile);

  const atlasText = await atlasFile.text();
  const expectedPages = parseAtlasPageNames(atlasText);
  const usedImages = new Set();

  for (const imgFile of imageFiles) {
    const dataUrl = await fileToDataUrl(imgFile);
    rawDataURIs[`local/${imgFile.name}`] = dataUrl;
    rawDataURIs[imgFile.name] = dataUrl;
  }

  // Ensure every page named in the .atlas resolves even if filenames differ slightly in casing or single-page fallback
  for (const pageName of expectedPages) {
    const exactKey = `local/${pageName}`;
    if (rawDataURIs[exactKey]) {
      usedImages.add(pageName.toLowerCase());
      continue;
    }
    const baseName = pageName.split(/[\\/]/).pop();
    const match = imageFiles.find(f => f.name.toLowerCase() === baseName.toLowerCase())
      || (expectedPages.length === 1 && imageFiles.length === 1 ? imageFiles[0] : null);
    if (match) {
      rawDataURIs[exactKey] = rawDataURIs[`local/${match.name}`];
      usedImages.add(match.name.toLowerCase());
    }
  }

  // Pick optional background image (explicit bg* file or unreferenced image)
  const bgFile = imageFiles.find(f => /^bg/i.test(f.name) && !usedImages.has(f.name.toLowerCase()))
    || imageFiles.find(f => !usedImages.has(f.name.toLowerCase()));
  const bgUrl = bgFile ? URL.createObjectURL(bgFile) : null;

  const baseTitle = skelFile.name.replace(/\.(skel(\.bytes|\.txt)?|json)$/i, "");
  const voices = audioFiles.map(af => ({
    name: af.name.replace(/\.(mp3|wav|ogg)$/i, ""),
    url: URL.createObjectURL(af)
  }));

  return {
    ready: true,
    id: baseTitle || "Local_Spine_Asset",
    skelKey,
    atlasKey,
    isJson,
    rawDataURIs,
    bgUrl,
    voices,
    unityBundles
  };
}
