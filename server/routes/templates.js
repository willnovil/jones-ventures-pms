import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACEHOLDERS } from "../lib/leaseDocx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, "..", "storage", "templates");
const LEASE_TEMPLATE_PATH = path.join(TEMPLATE_DIR, "lease-template.docx");

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

// GET /api/templates/lease — return current template metadata or null
router.get("/lease", async (_req, res) => {
  try {
    const stat = await fs.stat(LEASE_TEMPLATE_PATH);
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
      await fs.mkdir(TEMPLATE_DIR, { recursive: true });
      await fs.writeFile(LEASE_TEMPLATE_PATH, req.file.buffer);
      const stat = await fs.stat(LEASE_TEMPLATE_PATH);
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
router.delete("/lease", async (_req, res) => {
  try {
    await fs.unlink(LEASE_TEMPLATE_PATH);
    res.status(204).end();
  } catch (err) {
    if (err.code === "ENOENT") return res.status(204).end();
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { LEASE_TEMPLATE_PATH };
