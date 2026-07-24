/* =========================================================
   WANZZ DEPLOY — apk.js (halaman Build APK, REAL BACKEND)
   Memicu GitHub Actions workflow untuk build APK Flutter sungguhan
   di server GitHub — bukan di server Wanzz Deploy. Lihat
   flutter-apk-workflow-template.yml untuk contoh workflow yang
   dibutuhkan di repo target.
   ========================================================= */

(() => {
  "use strict";

  const API_BASE = "";
  let STATUS_GITHUB = { configured: false, status: "CHECKING..." };
  let githubUser = "wanzz-dev";
  let selectedRepo = null;

  /* ---------- particle background canvas ---------- */
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];

  function resizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function initParticles(count){
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.5 + 0.15,
    }));
  }
  function tickParticles(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,149,156,${p.a * 0.5})`;
      ctx.fill();
    });
    requestAnimationFrame(tickParticles);
  }
  resizeCanvas();
  initParticles(Math.min(90, Math.floor((window.innerWidth * window.innerHeight) / 14000)));
  tickParticles();
  window.addEventListener("resize", () => { resizeCanvas(); initParticles(particles.length); });

  function spawnBannerParticles(){
    const host = document.getElementById("banner-particles");
    if (!host) return;
    for (let i = 0; i < 22; i++){
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.bottom = "-10px";
      s.style.animationDuration = 4 + Math.random() * 5 + "s";
      s.style.animationDelay = Math.random() * 6 + "s";
      host.appendChild(s);
    }
  }
  spawnBannerParticles();

  /* ---------- status GitHub asli ---------- */
  async function fetchGithubStatus(){
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      STATUS_GITHUB = data.github || { configured: false, status: "NOT CONFIGURED" };
      if (data.githubUser) githubUser = data.githubUser;
    } catch (err) {
      STATUS_GITHUB = { configured: false, status: "NOT CONFIGURED" };
      console.warn("[wanzz-deploy] Gagal memuat /api/status:", err);
    }
  }

  function renderStatusUI(){
    const navUser = document.getElementById("nav-user");
    if (navUser) navUser.textContent = `◆ ${githubUser} — Quick Session Aktif`;

    const card = document.querySelector(".api-card");
    if (!card) return;
    const stateEl = card.querySelector(".api-state");
    const hintEl  = card.querySelector(".api-key-hint");
    const ok = STATUS_GITHUB.configured;
    if (hintEl) hintEl.textContent = ok ? "env: GITHUB_TOKEN ✓" : "env: GITHUB_TOKEN — belum diatur";
    if (stateEl){
      stateEl.innerHTML = `<span class="led"></span> ${STATUS_GITHUB.status}`;
      stateEl.style.color = ok ? "" : "var(--danger)";
      const led = stateEl.querySelector(".led");
      if (led && !ok){
        led.style.background = "var(--danger)";
        led.style.animation = "none";
      }
    }
  }

  /* ---------- repo selector (khusus repo Flutter) ---------- */
  const repoGrid = document.getElementById("repo-grid");
  const apkSelectedRepoLabel = document.getElementById("apk-selected-repo-label");

  function selectRepoCard(card){
    document.querySelectorAll(".repo-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedRepo = card.dataset.repo;
    if (apkSelectedRepoLabel) apkSelectedRepoLabel.textContent = selectedRepo;
  }

  function bindRepoCard(card){
    card.addEventListener("click", () => selectRepoCard(card));
  }

  async function loadRealRepos(){
    if (!repoGrid) return;
    try {
      const res = await fetch(`${API_BASE}/api/github`);
      const data = await res.json();
      if (!data.configured || data.error || !data.repos || data.repos.length === 0) return;

      repoGrid.innerHTML = "";
      data.repos.forEach((r, i) => {
        const card = document.createElement("div");
        card.className = "repo-card";
        card.dataset.repo = r.fullName;
        card.innerHTML = `
          <span class="repo-dot"></span>
          <div class="repo-meta">
            <span class="repo-name">${r.name}</span>
            <span class="repo-branch">${r.branch} · ${r.language}${r.private ? " · private" : ""}</span>
          </div>
        `;
        bindRepoCard(card);
        repoGrid.appendChild(card);
        if (i === 0) selectRepoCard(card);
      });
    } catch (err) {
      console.warn("[wanzz-deploy] Gagal memuat /api/github:", err);
    }
  }
  document.querySelectorAll(".repo-card").forEach(bindRepoCard);

  /* ---------- console log ---------- */
  const consoleBody = document.getElementById("console-body");

  function pushConsoleLine(text, cls = "", withCursor = false){
    const oldCursor = consoleBody.querySelector(".console-cursor");
    if (oldCursor) oldCursor.remove();
    const line = document.createElement("div");
    line.className = "console-line " + cls;
    line.textContent = text;
    if (withCursor){
      const cursor = document.createElement("span");
      cursor.className = "console-cursor";
      line.appendChild(cursor);
    }
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
    return line;
  }
  function clearConsole(){ consoleBody.innerHTML = ""; }
  function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

  /* ---------- push workflow template ke repo terpilih ----------
     Ini yang menyelesaikan error "Not Found" saat build: workflow
     harus benar-benar ADA di repo (.github/workflows/build-apk.yml)
     sebelum bisa dipicu. Tombol ini mengambil isi
     flutter-apk-workflow-template.yml dari situs ini sendiri, lalu
     push ke repo terpilih lewat /api/github (Contents API asli). */
  const pushWorkflowBtn = document.getElementById("push-workflow-btn");

  if (pushWorkflowBtn){
    pushWorkflowBtn.addEventListener("click", async () => {
      if (!selectedRepo){
        clearConsole();
        pushConsoleLine("$ wanzz push-workflow", "");
        pushConsoleLine("✗ Belum ada repository yang dipilih.", "err");
        return;
      }
      if (!STATUS_GITHUB.configured){
        clearConsole();
        pushConsoleLine("$ wanzz push-workflow", "");
        pushConsoleLine("✗ GITHUB_TOKEN belum diisi di api/_lib/config.js.", "err");
        return;
      }

      const workflowFile = (apkWorkflowInput && apkWorkflowInput.value.trim()) || "build-apk.yml";
      const repoNameOnly = selectedRepo.includes("/") ? selectedRepo.split("/").pop() : selectedRepo;

      pushWorkflowBtn.classList.add("is-loading");
      clearConsole();
      pushConsoleLine(`$ wanzz push-workflow --repo=${selectedRepo} --file=${workflowFile}`, "");
      await delay(150);

      try {
        pushConsoleLine("Mengambil template workflow dari situs ini...", "info");
        const tplRes = await fetch("flutter-apk-workflow-template.yml");
        if (!tplRes.ok) throw new Error("Gagal memuat template (status " + tplRes.status + ")");
        const templateContent = await tplRes.text();

        await delay(200);
        pushConsoleLine(`Push .github/workflows/${workflowFile} ke ${selectedRepo}...`, "info");

        const res = await fetch(`${API_BASE}/api/github`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoName: repoNameOnly,
            files: [{ path: `.github/workflows/${workflowFile}`, content: templateContent, encoding: "utf8" }],
          }),
        });
        const data = await res.json();

        if (!res.ok || !data.ok){
          pushConsoleLine(`✗ Gagal push workflow: ${data.error || res.statusText}`, "err");
          if (data.detail) pushConsoleLine("  " + JSON.stringify(data.detail).slice(0, 220), "dim");
        } else {
          pushConsoleLine("✓ Workflow berhasil ditambahkan ke repo.", "ok");
          await delay(200);
          pushConsoleLine("✓ Sekarang kamu bisa klik 'Build APK dari Repo Terpilih' di bawah.", "ok");
        }
      } catch (err) {
        pushConsoleLine("✗ Gagal push workflow: " + String(err), "err");
      }

      pushConsoleLine("", "", true);
      pushWorkflowBtn.classList.remove("is-loading");
    });
  }

  /* ---------- build APK lewat GitHub Actions ---------- */
  const buildApkBtn = document.getElementById("build-apk-btn");
  const apkWorkflowInput = document.getElementById("apk-workflow-input");
  const apkBranchInput = document.getElementById("apk-branch-input");
  const apkResult = document.getElementById("apk-result");
  const apkResultStatusText = document.getElementById("apk-result-status-text");
  const apkSpinner = document.getElementById("apk-spinner");
  const apkDownloadList = document.getElementById("apk-download-list");

  function formatBytes(bytes){
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatElapsed(ms){
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  function setSpinning(on){
    if (apkSpinner) apkSpinner.classList.toggle("spinning", on);
  }

  async function pollBuildStatus(repoFullName, runId, actionsUrl){
    apkResult.classList.remove("hidden");
    apkDownloadList.innerHTML = "";
    setSpinning(true);

    const startedAt = Date.now();
    const maxAttempts = 40; // ~40 x 15s = 10 menit maksimum polling

    for (let attempt = 0; attempt < maxAttempts; attempt++){
      const elapsed = formatElapsed(Date.now() - startedAt);
      let data;
      try {
        const res = await fetch(`${API_BASE}/api/build-apk-status?repoFullName=${encodeURIComponent(repoFullName)}&runId=${runId}`);
        data = await res.json();
      } catch (err){
        setSpinning(false);
        apkResultStatusText.textContent = "Gagal mengecek status build. Coba refresh halaman.";
        pushConsoleLine(`✗ [${elapsed}] Gagal menghubungi /api/build-apk-status.`, "err");
        return;
      }

      if (!data.ok){
        setSpinning(false);
        apkResultStatusText.textContent = `Gagal mengecek status: ${data.error || "unknown error"}`;
        pushConsoleLine(`✗ [${elapsed}] ${data.error || "unknown error"}`, "err");
        return;
      }

      if (data.status !== "completed"){
        const statusLabel = data.status === "queued" ? "mengantre di runner GitHub"
                            : data.status === "in_progress" ? "sedang build (install Flutter SDK, compile, dll)"
                            : data.status;
        apkResultStatusText.textContent = `[${elapsed}] Sedang build — ${statusLabel}...`;
        pushConsoleLine(`… [${elapsed}] status: ${data.status} — masih berjalan di GitHub Actions (cek #${attempt + 1})`, "dim");
        await delay(15000);
        continue;
      }

      // status completed
      setSpinning(false);
      if (data.conclusion !== "success"){
        apkResultStatusText.textContent = `[${elapsed}] Build selesai dengan hasil: ${data.conclusion}. Cek log build di GitHub Actions untuk detail error.`;
        pushConsoleLine(`✗ [${elapsed}] Build selesai dengan status: ${data.conclusion}`, "err");
        const link = document.createElement("a");
        link.href = data.htmlUrl || actionsUrl;
        link.target = "_blank";
        link.className = "apk-download-btn";
        link.textContent = "🔗 Buka Log Build di GitHub";
        apkDownloadList.appendChild(link);
        return;
      }

      if (!data.artifacts || data.artifacts.length === 0){
        apkResultStatusText.textContent = `[${elapsed}] Build sukses, tapi tidak ada artifact ditemukan. Cek langkah 'Upload APK sebagai artifact' di workflow kamu.`;
        pushConsoleLine(`⚠ [${elapsed}] Build sukses tapi tidak ada artifact.`, "warn");
        return;
      }

      apkResultStatusText.textContent = `[${elapsed}] ✓ Build sukses! ${data.artifacts.length} file siap diunduh:`;
      pushConsoleLine(`✓ [${elapsed}] Build sukses! ${data.artifacts.length} artifact ditemukan.`, "ok");
      data.artifacts.forEach((a) => {
        const row = document.createElement("div");
        row.className = "apk-download-row";
        row.innerHTML = `
          <div>
            <div class="f-name">${a.name}</div>
            <div class="f-size">${formatBytes(a.sizeBytes)}</div>
          </div>
        `;
        const btn = document.createElement("a");
        btn.href = `${API_BASE}/api/build-apk-download?repoFullName=${encodeURIComponent(repoFullName)}&artifactId=${a.id}`;
        btn.className = "apk-download-btn";
        btn.textContent = "⬇ Download";
        row.appendChild(btn);
        apkDownloadList.appendChild(row);
      });
      return;
    }

    setSpinning(false);
    apkResultStatusText.textContent = "Polling dihentikan (build kelamaan). Cek manual di GitHub Actions.";
    pushConsoleLine("⚠ Polling dihentikan setelah 10 menit — cek manual di GitHub Actions.", "warn");
    const link = document.createElement("a");
    link.href = actionsUrl;
    link.target = "_blank";
    link.className = "apk-download-btn";
    link.textContent = "🔗 Buka GitHub Actions";
    apkDownloadList.appendChild(link);
  }

  if (buildApkBtn){
    buildApkBtn.addEventListener("click", async () => {
      if (!selectedRepo){
        clearConsole();
        pushConsoleLine("$ wanzz build-apk", "");
        pushConsoleLine("✗ Belum ada repository yang dipilih.", "err");
        pushConsoleLine("  Pilih repo Flutter kamu dulu di panel 'Pilih Repository Flutter'.", "warn");
        return;
      }
      if (!STATUS_GITHUB.configured){
        clearConsole();
        pushConsoleLine("$ wanzz build-apk", "");
        pushConsoleLine("✗ GITHUB_TOKEN belum diisi di api/_lib/config.js.", "err");
        return;
      }

      const workflowFile = (apkWorkflowInput && apkWorkflowInput.value.trim()) || "build-apk.yml";
      const ref = (apkBranchInput && apkBranchInput.value.trim()) || "main";

      buildApkBtn.classList.add("is-loading");
      clearConsole();
      apkResult.classList.add("hidden");
      pushConsoleLine(`$ wanzz build-apk --repo=${selectedRepo} --workflow=${workflowFile} --branch=${ref}`, "");
      await delay(200);
      pushConsoleLine("Memeriksa workflow (otomatis dibuat kalau belum ada)...", "info");

      try {
        const res = await fetch(`${API_BASE}/api/build-apk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoFullName: selectedRepo, workflowFile, ref }),
        });
        const data = await res.json();

        if (!res.ok || !data.ok){
          pushConsoleLine(`✗ Gagal di langkah: ${data.step || "unknown"}`, "err");
          pushConsoleLine(`  Pesan: ${data.error || res.statusText}`, "err");
          if (data.location){
            pushConsoleLine(`  Repo: ${data.location.repoFullName}`, "dim");
            pushConsoleLine(`  File workflow: ${data.location.workflowPath}`, "dim");
            pushConsoleLine(`  Branch: ${data.location.ref}`, "dim");
            if (data.location.githubStatus) pushConsoleLine(`  Status GitHub API: ${data.location.githubStatus}`, "dim");
            if (data.location.endpoint) pushConsoleLine(`  Endpoint: ${data.location.endpoint}`, "dim");
          }
          if (data.detail && data.detail.message){
            pushConsoleLine(`  Detail dari GitHub: ${data.detail.message}`, "dim");
          }
          if (data.hint) pushConsoleLine(`  💡 ${data.hint}`, "warn");
        } else {
          pushConsoleLine("✓ Workflow build APK berhasil dipicu di GitHub Actions.", "ok");
          await delay(250);
          if (data.runId){
            pushConsoleLine("✓ Memantau progres build otomatis — hasil APK akan muncul di bawah untuk didownload langsung.", "ok");
            pushConsoleLine("  (build Flutter biasanya makan waktu beberapa menit, halaman ini akan cek berkala)", "dim");
            pollBuildStatus(selectedRepo, data.runId, data.actionsUrl);
          } else {
            pushConsoleLine(`✓ Pantau progres & unduh APK manual di: ${data.actionsUrl}`, "ok");
            pushConsoleLine("  (run ID tidak terdeteksi otomatis — buka link di atas)", "warn");
          }
        }
      } catch (err) {
        pushConsoleLine("✗ Gagal menghubungi /api/build-apk — pastikan situs ini dideploy sebagai Vercel project.", "err");
        pushConsoleLine("  " + String(err), "dim");
      }

      pushConsoleLine("", "", true);
      buildApkBtn.classList.remove("is-loading");
    });
  }

  /* ---------- init ---------- */
  fetchGithubStatus().then(loadRealRepos).then(renderStatusUI);

})();
