import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACEHOLDERS } from "../lib/leaseDocx.js";
import { requireOrganization } from "../middleware/requireOrganization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.join(__dirname, "..", "storage");

// Per-org template path helpers. Exported for leases.js + tests.
export function templateDirFor(organizationId) {
  return path.join(STORAGE_ROOT, organizationId, "templates");
}
export function leaseTemplatePathFor(organizationId) {
  return path.join(templateDirFor(organizationId), "lease-template.docx");
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const isDocxMime = file.mimetype === DOCX_MIME;
    const isDocxExt = file.originalname.toLowerCase().endsWith(".docx");
    if (!isDocxMime && !isDocxExt) {
      return cb(new Error("Only .docx files are allowed"));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireOrganization);

// GET /api/templates/lease — return current template metadata or null
router.get("/lease", async (req, res) => {
  try {
    const templatePath = leaseTemplatePathFor(req.organizationId);
    const stat = await fs.stat(templatePath);
    res.json({
      exists: true,
      size: stat.size,
      uploadedAt: stat.mtime,
      placeholders: PLACEHOLDERS,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ exists: false, placeholders: PLACEHOLDERS });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates/lease — upload (or replace) the lease template
router.post("/lease", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const dir = templateDirFor(req.organizationId);
      const templatePath = leaseTemplatePathFor(req.organizationId);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(templatePath, req.file.buffer);
      const stat = await fs.stat(templatePath);
      res.status(201).json({
        exists: true,
        size: stat.size,
        uploadedAt: stat.mtime,
        placeholders: PLACEHOLDERS,
      });
    } catch (writeErr) {
      res.status(500).json({ error: writeErr.message });
    }
  });
});

// DELETE /api/templates/lease — remove the current template
router.delete("/lease", async (req, res) => {
  try {
    await fs.unlink(leaseTemplatePathFor(req.organizationId));
    res.status(204).end();
  } catch (err) {
    if (err.code === "ENOENT") return res.status(204).end();
    res.status(500).json({ error: err.message });
  }
});

export default router;
