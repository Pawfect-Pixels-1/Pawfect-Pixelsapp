// server/routes/googleSheets.ts
import { Router } from "express";
import { getGoogleSheetsService } from "../services/googleSheets";

const router = Router();

/**
 * POST /api/admin/export-sheets
 * Manual export endpoint protected by ADMIN_EXPORT_TOKEN
 */
router.post("/export-sheets", async (req, res) => {
  try {
    // Check admin token
    const adminToken = process.env.ADMIN_EXPORT_TOKEN;
    const providedToken = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

    if (!adminToken || !providedToken || adminToken !== providedToken) {
      return res.status(401).json({ 
        error: "Unauthorized. Valid ADMIN_EXPORT_TOKEN required." 
      });
    }

    console.log("🔐 Admin export request authenticated");

    // Perform the export
    const sheetsService = getGoogleSheetsService();
    await sheetsService.performFullExport();

    res.status(200).json({ 
      success: true, 
      message: "Google Sheets export completed successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("❌ Manual export failed:", error);
    res.status(500).json({ 
      error: "Export failed", 
      details: error.message 
    });
  }
});

/**
 * GET /api/admin/export-status
 * Get the current sync state and export status
 */
router.get("/export-status", async (req, res) => {
  try {
    // Check admin token
    const adminToken = process.env.ADMIN_EXPORT_TOKEN;
    const providedToken = req.headers.authorization?.replace('Bearer ', '');

    if (!adminToken || !providedToken || adminToken !== providedToken) {
      return res.status(401).json({ 
        error: "Unauthorized. Valid ADMIN_EXPORT_TOKEN required." 
      });
    }

    const sheetsService = getGoogleSheetsService();
    const syncState = await sheetsService.getSyncState();

    res.status(200).json({
      success: true,
      syncState,
      spreadsheetTitle: process.env.GSHEETS_SPREADSHEET_TITLE || 'Portrait Studio - Data Lake'
    });

  } catch (error: any) {
    console.error("❌ Failed to get export status:", error);
    res.status(500).json({ 
      error: "Failed to get export status", 
      details: error.message 
    });
  }
});

export const googleSheetsRouter = router;