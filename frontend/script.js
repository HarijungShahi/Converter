const API_BASE_URL = "http://localhost:3000"; // Change to production URL later

const form = document.getElementById("convertForm");
const statusEl = document.getElementById("status");
const historyList = document.getElementById("historyList");
const fileInput = document.getElementById("fileInput");
const targetSelect = document.getElementById("targetSelect");
const selectedFilesList = document.getElementById("selectedFiles");
const dropZone = document.getElementById("dropZone");
const progressWrap = document.getElementById("progressWrap");
const progressLabel = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const inputPreview = document.getElementById("inputPreview");
const outputPreview = document.getElementById("outputPreview");
const downloadAllBtn = document.getElementById("downloadAllBtn");

// Auth Elements
const authNav = document.getElementById("authNav");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authModalTitle = document.getElementById("authModalTitle");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");

let currentUser = null;
let authMode = "login"; // login or register

let selectedFiles = [];
let pendingDownloads = [];
const fallbackSupportedMap = {
  pdf: ["docx", "doc", "xlsx"],
  doc: ["pdf"],
  docx: ["pdf"],
  png: ["jpg", "jpeg", "webp", "tiff"],
  jpg: ["png", "webp", "tiff"],
  jpeg: ["png", "webp", "tiff"],
  webp: ["png", "jpg", "jpeg", "tiff"],
  tiff: ["png", "jpg", "jpeg", "webp"],
  gif: ["png", "jpg", "jpeg", "webp"],
  bmp: ["png", "jpg", "jpeg", "webp"],
  mp4: ["mp3", "wav", "webm", "avi", "mkv"],
  mp3: ["mp4", "wav"],
  wav: ["mp3", "mp4"],
  avi: ["mp4", "mp3", "webm"],
  mkv: ["mp4", "mp3", "webm"],
  webm: ["mp4", "mp3", "avi", "mkv"]
};

function getExt(fileName) {
  const pieces = fileName.toLowerCase().split(".");
  return pieces.length > 1 ? pieces[pieces.length - 1] : "";
}

function setStatus(text) {
  statusEl.textContent = text;
}

function getDownloadNameFromResponse(res) {
  const contentDisposition = res.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  if (match && match[1]) {
    return match[1];
  }
  return "";
}

function clearElement(el) {
  el.innerHTML = "";
}

function setDownloadButtonState() {
  downloadAllBtn.disabled = pendingDownloads.length === 0;
}

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function appendFilePreview(container, fileName, ext, sourceUrl, metaText, downloadName) {
  const block = document.createElement("div");
  block.style.marginBottom = "12px";
  const title = document.createElement("p");
  title.style.margin = "0 0 6px";
  title.textContent = `${fileName}${metaText ? ` (${metaText})` : ""}`;
  block.appendChild(title);

  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    const img = document.createElement("img");
    img.src = sourceUrl;
    img.alt = fileName;
    block.appendChild(img);
  } else if (ext === "pdf") {
    const frame = document.createElement("iframe");
    frame.src = sourceUrl;
    block.appendChild(frame);
  } else if (ext === "mp3") {
    const audio = document.createElement("audio");
    audio.src = sourceUrl;
    audio.controls = true;
    block.appendChild(audio);
  } else if (ext === "mp4") {
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.controls = true;
    block.appendChild(video);
  } else {
    const note = document.createElement("p");
    note.style.margin = "0";
    note.textContent = "Preview not available for this format. You can still download.";
    block.appendChild(note);
  }

  if (downloadName) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "secondary-btn";
    action.style.marginTop = "8px";
    action.textContent = `Download ${downloadName}`;
    action.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = sourceUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    block.appendChild(action);
  }

  container.appendChild(block);
}

function showProgress() {
  progressWrap.classList.remove("hidden");
}

function hideProgress() {
  progressWrap.classList.add("hidden");
}

function setProgress(percent, label) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressFill.style.width = `${safePercent}%`;
  progressPercent.textContent = `${safePercent}%`;
  if (label) {
    progressLabel.textContent = label;
  }
}

async function fetchTargetsForExt(ext) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/supported-targets/${ext}`);
    if (!res.ok) {
      return fallbackSupportedMap[ext] || [];
    }
    const payload = await res.json();
    return payload.targets || fallbackSupportedMap[ext] || [];
  } catch (_error) {
    return fallbackSupportedMap[ext] || [];
  }
}

function renderSelectedFiles() {
  selectedFilesList.innerHTML = "";
  selectedFiles.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = file.name;
    selectedFilesList.appendChild(li);
  });
}

function setTargetOptions(options) {
  targetSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select target format";
  targetSelect.appendChild(placeholder);

  options.forEach((ext) => {
    const option = document.createElement("option");
    option.value = ext;
    option.textContent = ext.toUpperCase();
    targetSelect.appendChild(option);
  });
}

async function updateTargetOptions() {
  if (!selectedFiles.length) {
    setTargetOptions([]);
    setStatus("Upload file(s) to see available conversion formats.");
    return;
  }

  const uniqueExts = [...new Set(selectedFiles.map((f) => getExt(f.name)))];
  const targetLists = await Promise.all(uniqueExts.map((ext) => fetchTargetsForExt(ext)));

  const commonTargets = targetLists.reduce((acc, list) => {
    if (!acc) return [...list];
    return acc.filter((item) => list.includes(item));
  }, null) || [];

  setTargetOptions(commonTargets);
  if (!commonTargets.length) {
    setStatus("No supported target format for selected file type(s).");
    return;
  }
  setStatus(`Available target format(s): ${commonTargets.join(", ").toUpperCase()}`);
}

async function setFiles(fileList) {
  selectedFiles = Array.from(fileList || []);
  renderSelectedFiles();
  pendingDownloads = [];
  setDownloadButtonState();
  clearElement(outputPreview);
  outputPreview.textContent = "No converted file yet.";
  clearElement(inputPreview);
  if (!selectedFiles.length) {
    inputPreview.textContent = "No file selected.";
  } else {
    selectedFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      appendFilePreview(inputPreview, file.name, getExt(file.name), url, humanSize(file.size));
    });
  }
  hideProgress();
  setProgress(0, "Progress");
  if (!selectedFiles.length) {
    setStatus("No files selected.");
  }
  await updateTargetOptions();
}

dropZone.addEventListener("click", () => {
  fileInput.click();
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  await setFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", async () => {
  await setFiles(fileInput.files);
});

async function refreshHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/conversions`, { credentials: "include" });
    const items = await res.json();
    historyList.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.inputName} (${item.sourceExt} -> ${item.targetExt}) [${item.status}]`;
      historyList.appendChild(li);
    });
    if(items.length === 0 && !currentUser) {
       const li = document.createElement("li");
       li.textContent = "Log in to see your private conversion history.";
       historyList.appendChild(li);
    } else if (items.length === 0) {
       const li = document.createElement("li");
       li.textContent = "No recent conversions.";
       historyList.appendChild(li);
    }
  } catch (_error) {
    historyList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "History unavailable right now.";
    historyList.appendChild(li);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedFiles.length) {
    setStatus("Please choose at least one file.");
    return;
  }

  const target = targetSelect.value;
  if (!target) {
    setStatus("Please choose a target format.");
    return;
  }

  setStatus(`Converting ${selectedFiles.length} file(s)...`);
  showProgress();
  setProgress(0, "Preparing...");

  let successCount = 0;
  let blockedByConnection = false;
  let failedCount = 0;
  const failureReasons = [];
  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      const startPercent = (index / selectedFiles.length) * 100;
      const endPercent = ((index + 1) / selectedFiles.length) * 100;
      const inFileSpan = endPercent - startPercent;

      setProgress(startPercent, `Uploading ${file.name}`);
      const data = new FormData();
      data.append("file", file);
      data.append("target", target);

      let res;
      try {
        setProgress(startPercent + inFileSpan * 0.2, `Converting ${file.name}`);
        res = await fetch(`${API_BASE_URL}/api/convert`, {
          method: "POST",
          body: data,
          credentials: "include"
        });
      } catch (_error) {
        setStatus("Could not reach server. Start app with: npm run dev");
        blockedByConnection = true;
        break;
      }

      if (!res.ok) {
        const err = await res
          .json()
          .catch(async () => ({ error: (await res.text().catch(() => "")) || "Unknown error" }));
        const message = err.error || `Request failed (${res.status})`;
        failureReasons.push(`${file.name}: ${message}`);
        setStatus(`Failed on ${file.name}: ${message}`);
        failedCount += 1;
        setProgress(endPercent, `Skipped ${file.name}`);
        continue;
      }

      setProgress(startPercent + inFileSpan * 0.85, `Downloading ${file.name}`);
      const contentType = res.headers.get("content-type");
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      let outputName = getDownloadNameFromResponse(res) || `${baseName}.${target}`;
      
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.downloadUrl) {
          outputName = data.outputName || outputName;
          pendingDownloads.push({ name: outputName, blobUrl: data.downloadUrl, size: 0 });
        }
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        pendingDownloads.push({ name: outputName, blobUrl: url, size: blob.size });
      }

      successCount += 1;
      setProgress(endPercent, `Completed ${file.name}`);
    }
  } catch (_error) {
    setStatus("Conversion stopped unexpectedly. Please try again.");
    return;
  }

  if (blockedByConnection) {
    return;
  }
  setProgress(100, "All files processed");
  clearElement(outputPreview);
  if (!pendingDownloads.length) {
    outputPreview.textContent = "No converted file yet.";
  } else {
    pendingDownloads.forEach((item) => {
      appendFilePreview(
        outputPreview,
        item.name,
        getExt(item.name),
        item.blobUrl,
        humanSize(item.size),
        item.name
      );
    });
  }
  setDownloadButtonState();
  let finalMessage = `Done. ${successCount}/${selectedFiles.length} downloaded, ${failedCount} failed.`;
  if (failureReasons.length) {
    finalMessage += ` Last error: ${failureReasons[failureReasons.length - 1]}`;
  }
  setStatus(finalMessage);
  refreshHistory();
});

downloadAllBtn.addEventListener("click", () => {
  if (!pendingDownloads.length) {
    setStatus("No converted files available to download.");
    return;
  }
  pendingDownloads.forEach((item) => {
    const a = document.createElement("a");
    a.href = item.blobUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  setStatus(`Download started for ${pendingDownloads.length} converted file(s).`);
});

refreshHistory();
setDownloadButtonState();

// Auth Logic
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    } else {
      currentUser = null;
    }
    updateAuthUI();
  } catch (err) {
    currentUser = null;
    updateAuthUI();
  }
}

function updateAuthUI() {
  if (currentUser) {
    authNav.innerHTML = `
      <span>Welcome, <strong>${currentUser.username}</strong></span>
      ${currentUser.role === 'admin' ? '<a href="/admin.html" class="secondary-btn" style="text-decoration:none; display:inline-block;">Admin Panel</a>' : ''}
      <button id="logoutBtn" class="secondary-btn">Logout</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
      currentUser = null;
      updateAuthUI();
      refreshHistory();
    });
  } else {
    authNav.innerHTML = `
      <button id="loginBtn" class="secondary-btn">Login</button>
      <button id="registerBtn" class="secondary-btn">Register</button>
    `;
    document.getElementById("loginBtn").addEventListener("click", () => openAuthModal("login"));
    document.getElementById("registerBtn").addEventListener("click", () => openAuthModal("register"));
  }
}

function openAuthModal(mode) {
  authMode = mode;
  authModalTitle.textContent = mode === "login" ? "Login" : "Register";
  authError.classList.add("hidden");
  authUsername.value = "";
  authPassword.value = "";
  authModal.classList.remove("hidden");
}

closeAuthModal.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

window.addEventListener("click", (e) => {
  if (e.target === authModal) {
    authModal.classList.add("hidden");
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const username = authUsername.value;
  const password = authPassword.value;
  const endpoint = authMode === "login" ? `${API_BASE_URL}/api/auth/login` : `${API_BASE_URL}/api/auth/register`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = data.error || "Authentication failed";
      authError.classList.remove("hidden");
    } else {
      authModal.classList.add("hidden");
      currentUser = data.user;
      updateAuthUI();
      refreshHistory();
    }
  } catch (err) {
    authError.textContent = "Network error";
    authError.classList.remove("hidden");
  }
});

checkAuth();
