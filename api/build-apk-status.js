// GET /api/build-apk-status?repoFullName=owner/repo&runId=123
//
// Mengecek status run GitHub Actions yang sedang/sudah berjalan, dan
// kalau sudah selesai + sukses, mengembalikan daftar artifact (hasil
// build APK) yang bisa didownload lewat /api/build-apk-download.
module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.GITHUB_TOKEN;

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed, gunakan GET." });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "GITHUB_TOKEN belum diisi di api/_lib/config.js." });
  }

  const repoFullName = req.query.repoFullName;
  const runId = req.query.runId;

  if (!repoFullName || !repoFullName.includes("/") || !runId) {
    return res.status(400).json({ ok: false, error: "Butuh query 'repoFullName' (owner/repo) dan 'runId'." });
  }
  const [owner, repo] = repoFullName.split("/");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  try {
    const runRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`, { headers });
    if (!runRes.ok) {
      return res.status(502).json({ ok: false, error: `Gagal ambil status run (${runRes.status})` });
    }
    const run = await runRes.json();

    const result = {
      ok: true,
      status: run.status,          // "queued" | "in_progress" | "completed"
      conclusion: run.conclusion,  // null selama belum selesai, lalu "success"/"failure"/dst
      htmlUrl: run.html_url,
      artifacts: [],
    };

    if (run.status === "completed" && run.conclusion === "success") {
      const artifactsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
        { headers }
      );
      if (artifactsRes.ok) {
        const artifactsData = await artifactsRes.json();
        result.artifacts = (artifactsData.artifacts || []).map((a) => ({
          id: a.id,
          name: a.name,
          sizeBytes: a.size_in_bytes,
          expired: a.expired,
        }));
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Gagal mengecek status build.", detail: String(err) });
  }
};
