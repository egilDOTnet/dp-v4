import { Requirement, RequirementHierarchy } from "@prisma/client";

// Try to use xlsx-js-style for formatting support, fall back to regular xlsx
let XLSX: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  XLSX = require("xlsx-js-style");
} catch {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  XLSX = require("xlsx");
  console.warn("xlsx-js-style not found, using xlsx (formatting will be limited)");
}

interface RequirementWithHierarchy extends Requirement {
  hierarchy: RequirementHierarchy & {
    parent?: RequirementHierarchy | null;
  };
}

interface ProjectInfo {
  name: string;
}

/**
 * Generate an Excel file for requirements following the template format
 * @param projectInfo - Project information
 * @param requirements - Array of approved requirements with hierarchy information
 * @returns Excel file buffer
 */
export function generateRequirementsExcel(
  projectInfo: ProjectInfo,
  requirements: RequirementWithHierarchy[]
): Buffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet data array
  const worksheetData: any[][] = [];

  // Row 1: Project name in column B
  worksheetData.push([null, projectInfo.name]);

  // Row 2: Empty
  worksheetData.push([null, null, null, null, null, null]);

  // Row 3: Section headers (will be merged)
  // A: "Customer requirements" (will merge A-C), D: "Vendor response" (will merge D-F)
  worksheetData.push(["Customer requirements", null, null, "Vendor response", null, null]);

  // Row 4: Column headers
  // A: "Req. #", B: "Requirement", C: "Priority", D: "Answer", E: "Description", F: "Reference"
  worksheetData.push(["Req. #", "Requirement", "Priority", "Answer", "Description", "Reference"]);

  // Organize requirements by hierarchy
  const hierarchyMap = new Map<string, RequirementWithHierarchy[]>();
  const level1HierarchySet = new Set<string>();
  const level1HierarchyMap = new Map<string, RequirementHierarchy & { parent?: RequirementHierarchy | null }>();

  // First pass: collect all requirements and identify level 1 hierarchies
  requirements.forEach((req) => {
    const hierarchy = req.hierarchy;
    const hierarchyId = hierarchy.id;

    if (!hierarchyMap.has(hierarchyId)) {
      hierarchyMap.set(hierarchyId, []);
    }
    hierarchyMap.get(hierarchyId)!.push(req);

    // If requirement is directly under level 1, add level 1
    if (!hierarchy.parent) {
      if (!level1HierarchySet.has(hierarchy.id)) {
        level1HierarchySet.add(hierarchy.id);
        level1HierarchyMap.set(hierarchy.id, hierarchy);
      }
    } else {
      // If requirement is under level 2, add the parent level 1
      const parentId = hierarchy.parent.id;
      if (!level1HierarchySet.has(parentId)) {
        level1HierarchySet.add(parentId);
        level1HierarchyMap.set(parentId, hierarchy.parent);
      }
    }
  });

  // Convert to array and sort by order
  const level1Hierarchies = Array.from(level1HierarchyMap.values()).sort((a, b) => a.order - b.order);

  // Track row types for formatting (using row indices in final worksheet)
  const rowTypes: Map<number, "hierarchy" | "blank" | "description" | "requirement"> = new Map();
  // Track hierarchy levels (1 or 2) for font sizing
  const hierarchyLevels: Map<number, 1 | 2> = new Map();

  // Build worksheet data starting at row 5
  level1Hierarchies.forEach((level1, level1Index) => {
    // Add blank row before new level 1 hierarchy (except first)
    if (level1Index > 0) {
      worksheetData.push([null, null, null, null, null, null]);
      rowTypes.set(worksheetData.length - 1, "blank");
    }

    // Level 1 hierarchy (column B only)
    const level1Row: any[] = [null, level1.title, null, null, null, null];
    worksheetData.push(level1Row);
    const level1RowIndex = worksheetData.length - 1;
    rowTypes.set(level1RowIndex, "hierarchy");
    hierarchyLevels.set(level1RowIndex, 1);

    // Level 1 description (column B only) if exists
    if (level1.description) {
      const level1DescRow: any[] = [null, level1.description, null, null, null, null];
      worksheetData.push(level1DescRow);
      rowTypes.set(worksheetData.length - 1, "description");
    }

    // Get level 2 hierarchies for this level 1
    const level2Hierarchies = Array.from(hierarchyMap.keys())
      .map((id) => {
        const reqs = hierarchyMap.get(id)!;
        return reqs[0].hierarchy;
      })
      .filter((h) => h.parent?.id === level1.id)
      .sort((a, b) => a.order - b.order);

    level2Hierarchies.forEach((level2, level2Index) => {
      // Add blank row before new level 2 hierarchy (except first)
      if (level2Index > 0) {
        worksheetData.push([null, null, null, null, null, null]);
        rowTypes.set(worksheetData.length - 1, "blank");
      }

      // Level 2 hierarchy (column B only)
      const level2Row: any[] = [null, level2.title, null, null, null, null];
      worksheetData.push(level2Row);
      const level2RowIndex = worksheetData.length - 1;
      rowTypes.set(level2RowIndex, "hierarchy");
      hierarchyLevels.set(level2RowIndex, 2);

      // Level 2 description (column B only) if exists
      if (level2.description) {
        const level2DescRow: any[] = [null, level2.description, null, null, null, null];
        worksheetData.push(level2DescRow);
        rowTypes.set(worksheetData.length - 1, "description");
      }

      // Get requirements for this level 2 hierarchy
      const level2Requirements = hierarchyMap.get(level2.id) || [];
      level2Requirements.sort((a, b) => a.order - b.order);

      // Add requirement rows
      level2Requirements.forEach((req) => {
        const reqRow: any[] = [
          req.number, // Column A: Requirement number
          req.description, // Column B: Requirement description only
          req.type, // Column C: Priority/Type
          "", // Column D: Answer
          "", // Column E: Description
          "", // Column F: Reference
        ];
        worksheetData.push(reqRow);
        rowTypes.set(worksheetData.length - 1, "requirement");
      });
    });

    // Also handle requirements directly under level 1 (if any)
    const level1Requirements = hierarchyMap.get(level1.id)?.filter(
      (req) => !req.hierarchy.parent
    ) || [];
    level1Requirements.sort((a, b) => a.order - b.order);

    if (level1Requirements.length > 0) {
      // Add blank row if there were level 2 hierarchies
      if (level2Hierarchies.length > 0) {
        worksheetData.push([null, null, null, null, null, null]);
        rowTypes.set(worksheetData.length - 1, "blank");
      }

      level1Requirements.forEach((req) => {
        const reqRow: any[] = [
          req.number, // Column A: Requirement number
          req.description, // Column B: Requirement description only
          req.type, // Column C: Priority/Type
          "", // Column D: Answer
          "", // Column E: Description
          "", // Column F: Reference
        ];
        worksheetData.push(reqRow);
        rowTypes.set(worksheetData.length - 1, "requirement");
      });
    }
  });

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 12 }, // Column A: Req. #
    { wch: 80 }, // Column B: Requirement
    { wch: 15 }, // Column C: Priority
    { wch: 15 }, // Column D: Answer
    { wch: 80 }, // Column E: Description (same width as column B)
    { wch: 20 }, // Column F: Reference
  ];

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  // Helper function to ensure cell exists and has style object
  const ensureCellStyle = (row: number, col: number) => {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    if (!worksheet[cellRef]) {
      // Only create empty cell if it doesn't exist
      worksheet[cellRef] = { t: "s", v: "" };
    }
    if (!worksheet[cellRef].s) {
      worksheet[cellRef].s = {};
    }
    return worksheet[cellRef];
  };

  // Format row 1 (project name) - bold, larger font
  const projectNameCell = ensureCellStyle(0, 1);
  projectNameCell.v = projectInfo.name;
  projectNameCell.t = "s";
  projectNameCell.s = {
    font: { bold: true, sz: 24 },
    alignment: { horizontal: "left", vertical: "top" },
  };

  // Format row 3 (section headers) - merge cells and apply formatting
  // Merge A-C for "Customer requirements"
  const customerReqCell = ensureCellStyle(2, 0); // A3 (start of merge)
  customerReqCell.v = "Customer requirements";
  customerReqCell.t = "s";
  customerReqCell.s = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "top" },
    fill: { fgColor: { rgb: "CFE2F3" } },
  };
  // Set merge range for A3:C3
  if (!worksheet["!merges"]) worksheet["!merges"] = [];
  worksheet["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });
  // Apply background to all merged cells
  for (let col = 0; col < 3; col++) {
    const cell = ensureCellStyle(2, col);
    cell.s.fill = { fgColor: { rgb: "CFE2F3" } };
    cell.s.alignment = { horizontal: "center", vertical: "top" };
  }

  // Merge D-F for "Vendor response"
  const vendorRespCell = ensureCellStyle(2, 3); // D3 (start of merge)
  vendorRespCell.v = "Vendor response";
  vendorRespCell.t = "s";
  vendorRespCell.s = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "top" },
    fill: { fgColor: { rgb: "D9EAD3" } },
  };
  // Set merge range for D3:F3
  worksheet["!merges"].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 5 } });
  // Apply background to all merged cells
  for (let col = 3; col < 6; col++) {
    const cell = ensureCellStyle(2, col);
    cell.s.fill = { fgColor: { rgb: "D9EAD3" } };
    cell.s.alignment = { horizontal: "center", vertical: "top" };
  }

  // Format row 4 (column headers) - bold for all columns A-F, white text
  // Columns A-C: Background #3D85C6, Columns D-F: Background #6AA84F
  const headerLabels = ["Req. #", "Requirement", "Priority", "Answer", "Description", "Reference"];
  for (let col = 0; col < 6; col++) {
    const headerCell = ensureCellStyle(3, col);
    headerCell.v = headerLabels[col];
    headerCell.t = "s";
    const bgColor = col < 3 ? "3D85C6" : "6AA84F"; // A-C: blue, D-F: green
    headerCell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } }, // White text
      alignment: { horizontal: "left", vertical: "top" },
      fill: { fgColor: { rgb: bgColor } },
    };
  }

  // Format all data rows (starting from row 5, index 4)
  for (let row = 4; row <= range.e.r; row++) {
    const rowType = rowTypes.get(row);
    
    if (rowType === "hierarchy") {
      // Hierarchy rows: background color in all columns A-F, bold text in column B
      // Use same background as blank rows (#F5F5F5)
      const hierarchyLevel = hierarchyLevels.get(row) || 1;
      const fontSize = hierarchyLevel === 1 ? 16 : 14;
      for (let col = 0; col < 6; col++) {
        const cell = ensureCellStyle(row, col);
        cell.s.fill = { fgColor: { rgb: "F5F5F5" } };
        cell.s.alignment = { horizontal: "left", vertical: "top" };
        if (col === 1) {
          // Column B: bold and wrap text with appropriate font size
          cell.s.font = { bold: true, sz: fontSize };
          cell.s.alignment = { ...cell.s.alignment, wrapText: true };
        }
      }
    } else if (rowType === "blank") {
      // Blank rows: background color in all columns A-F
      for (let col = 0; col < 6; col++) {
        const cell = ensureCellStyle(row, col);
        cell.s.fill = { fgColor: { rgb: "F5F5F5" } };
        cell.s.alignment = { horizontal: "left", vertical: "top" };
      }
    } else if (rowType === "description") {
      // Description rows: background color in all columns A-F, italic and wrap text in column B
      for (let col = 0; col < 6; col++) {
        const cell = ensureCellStyle(row, col);
        cell.s.fill = { fgColor: { rgb: "F5F5F5" } };
        cell.s.alignment = { horizontal: "left", vertical: "top" };
        if (col === 1) {
          // Column B: italic, wrap text
          cell.s.alignment = { ...cell.s.alignment, wrapText: true };
          cell.s.font = { sz: 11, italic: true };
        }
      }
    } else if (rowType === "requirement") {
      // Requirement rows: format all columns
      // Column A: Requirement number
      const cellA = ensureCellStyle(row, 0);
      if (cellA.v !== null && cellA.v !== undefined && cellA.v !== "") {
        cellA.s.font = { sz: 11 };
        cellA.s.alignment = { horizontal: "left", vertical: "top" };
      }

      // Column B: Requirement description
      const cellB = ensureCellStyle(row, 1);
      if (cellB.v !== null && cellB.v !== undefined && cellB.v !== "") {
        cellB.s.font = { sz: 11 };
        cellB.s.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      }

      // Column C: Priority/Type
      const cellC = ensureCellStyle(row, 2);
      if (cellC.v !== null && cellC.v !== undefined && cellC.v !== "") {
        cellC.s.font = { sz: 11 };
        cellC.s.alignment = { horizontal: "left", vertical: "top" };
      }

      // Column D: Answer
      const cellD = ensureCellStyle(row, 3);
      cellD.s.font = { sz: 11 };
      cellD.s.alignment = { horizontal: "center", vertical: "top" };

      // Column E: Description
      const cellE = ensureCellStyle(row, 4);
      cellE.s.font = { sz: 11 };
      cellE.s.alignment = { horizontal: "left", vertical: "top", wrapText: true };

      // Column F: Reference
      const cellF = ensureCellStyle(row, 5);
      cellF.s.font = { sz: 11 };
      cellF.s.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    }
  }

  // Add data validation for column D (Yes/No/Partial) - only for requirement rows
  const requirementRowIndices = Array.from(rowTypes.entries())
    .filter(([_, type]) => type === "requirement")
    .map(([row, _]) => row);

  if (requirementRowIndices.length > 0) {
    const firstReqRow = Math.min(...requirementRowIndices);
    const lastReqRow = Math.max(...requirementRowIndices);
    
    // Create data validation range (Column D)
    const dataValidationRange = XLSX.utils.encode_range({
      s: { r: firstReqRow, c: 3 }, // Column D (0-indexed: 3)
      e: { r: lastReqRow, c: 3 },
    });

  // Add data validation to worksheet
  // For xlsx-js-style, the format should be:
  worksheet["!dataValidation"] = [{
    sqref: dataValidationRange,
    type: "list",
    formula1: "Yes,No,Partial", // Comma-separated values without extra quotes
    allowBlank: true,
    showInputMessage: true,
    showErrorMessage: true,
  }];
  }

  // Add worksheet to workbook
  const sheetName = projectInfo.name.length > 31 ? projectInfo.name.substring(0, 31) : projectInfo.name;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}
