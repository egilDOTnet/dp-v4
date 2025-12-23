import ExcelJS from "exceljs";
import { Requirement, RequirementHierarchy } from "@prisma/client";

interface RequirementWithHierarchy extends Requirement {
  hierarchy: RequirementHierarchy & {
    parent?: RequirementHierarchy | null;
  };
}

interface ProjectInfo {
  name: string;
}

/**
 * Convert hex color to ExcelJS ARGB format
 * @param hex - Hex color string (e.g., "#3D85C6" or "3D85C6")
 * @returns ARGB string (e.g., "FF3D85C6")
 */
function hexToArgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  // Add alpha channel (FF = fully opaque)
  return `FF${cleanHex.toUpperCase()}`;
}

/**
 * Generate an Excel file for requirements following the template format
 * @param projectInfo - Project information
 * @param requirements - Array of approved requirements with hierarchy information
 * @returns Excel file buffer
 */
export async function generateRequirementsExcel(
  projectInfo: ProjectInfo,
  requirements: RequirementWithHierarchy[]
): Promise<Buffer> {
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  
  // Clean worksheet name (Excel has restrictions on sheet names)
  let sheetName = projectInfo.name
    .replace(/[\\/:?*[\]]/g, "") // Remove invalid characters
    .trim();
  if (sheetName.length > 31) {
    sheetName = sheetName.substring(0, 31);
  }
  if (sheetName.length === 0) {
    sheetName = "Requirements";
  }
  
  const worksheet = workbook.addWorksheet(sheetName);

  // Set column widths
  worksheet.getColumn(1).width = 12; // Column A: Req. #
  worksheet.getColumn(2).width = 80; // Column B: Requirement
  worksheet.getColumn(3).width = 15; // Column C: Priority
  worksheet.getColumn(4).width = 15; // Column D: Answer
  worksheet.getColumn(5).width = 80; // Column E: Description
  worksheet.getColumn(6).width = 20; // Column F: Reference

  // Row 1: Project name in column B, "Unanswered:" label in column D
  const row1 = worksheet.getRow(1);
  row1.getCell(2).value = projectInfo.name;
  row1.getCell(2).font = { bold: true, size: 24 };
  row1.getCell(2).alignment = { horizontal: "left", vertical: "top" };
  
  // Add "Unanswered:" label in D1
  row1.getCell(4).value = "Unanswered:";
  row1.getCell(4).font = { size: 11 };
  row1.getCell(4).alignment = { horizontal: "center", vertical: "bottom" };

  // Row 2: Empty (skip)

  // Row 3: Section headers (merged cells)
  const row3 = worksheet.getRow(3);
  
  // Merge A-C for "Customer requirements"
  worksheet.mergeCells(3, 1, 3, 3);
  const customerReqCell = row3.getCell(1);
  customerReqCell.value = "Customer requirements";
  customerReqCell.font = { bold: true, size: 14 };
  customerReqCell.alignment = { horizontal: "center", vertical: "top" };
  customerReqCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: hexToArgb("CFE2F3") },
  };
  // Apply background to merged cells
  for (let col = 1; col <= 3; col++) {
    const cell = row3.getCell(col);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexToArgb("CFE2F3") },
    };
    cell.alignment = { horizontal: "center", vertical: "top" };
  }

  // Merge D-F for "Vendor response"
  worksheet.mergeCells(3, 4, 3, 6);
  const vendorRespCell = row3.getCell(4);
  vendorRespCell.value = "Vendor response";
  vendorRespCell.font = { bold: true, size: 14 };
  vendorRespCell.alignment = { horizontal: "center", vertical: "top" };
  vendorRespCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: hexToArgb("D9EAD3") },
  };
  // Apply background to merged cells
  for (let col = 4; col <= 6; col++) {
    const cell = row3.getCell(col);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexToArgb("D9EAD3") },
    };
    cell.alignment = { horizontal: "center", vertical: "top" };
  }

  // Row 4: Column headers
  const row4 = worksheet.getRow(4);
  const headerLabels = ["Req. #", "Requirement", "Priority", "Answer", "Description", "Reference"];
  for (let col = 1; col <= 6; col++) {
    const headerCell = row4.getCell(col);
    headerCell.value = headerLabels[col - 1];
    const bgColor = col <= 3 ? "3D85C6" : "6AA84F"; // A-C: blue, D-F: green
    headerCell.font = { bold: true, color: { argb: hexToArgb("FFFFFF") } };
    headerCell.alignment = { horizontal: "left", vertical: "top" };
    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexToArgb(bgColor) },
    };
  }

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

  // Track row types for formatting and data validation
  const rowTypes: Map<number, "hierarchy" | "blank" | "description" | "requirement"> = new Map();
  // Track hierarchy levels (1 or 2) for font sizing
  const hierarchyLevels: Map<number, 1 | 2> = new Map();
  // Track requirement row numbers for data validation
  const requirementRowNumbers: number[] = [];

  // Current row index (starting at row 5, which is index 5 in ExcelJS)
  let currentRow = 5;

  // Build worksheet data starting at row 5
  level1Hierarchies.forEach((level1, level1Index) => {
    // Add blank row before new level 1 hierarchy (except first)
    if (level1Index > 0) {
      const blankRow = worksheet.getRow(currentRow);
      for (let col = 1; col <= 6; col++) {
        const cell = blankRow.getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hexToArgb("F5F5F5") },
        };
        cell.alignment = { horizontal: "left", vertical: "top" };
      }
      rowTypes.set(currentRow, "blank");
      currentRow++;
    }

    // Level 1 hierarchy (column B only)
    const level1Row = worksheet.getRow(currentRow);
    level1Row.getCell(2).value = level1.title;
    for (let col = 1; col <= 6; col++) {
      const cell = level1Row.getCell(col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hexToArgb("F5F5F5") },
      };
      cell.alignment = { horizontal: "left", vertical: "top" };
      if (col === 2) {
        // Column B: bold and wrap text with appropriate font size
        cell.font = { bold: true, size: 16 };
        cell.alignment = { ...cell.alignment, wrapText: true };
      }
    }
    rowTypes.set(currentRow, "hierarchy");
    hierarchyLevels.set(currentRow, 1);
    currentRow++;

    // Level 1 description (column B only) if exists
    if (level1.description) {
      const level1DescRow = worksheet.getRow(currentRow);
      level1DescRow.getCell(2).value = level1.description;
      for (let col = 1; col <= 6; col++) {
        const cell = level1DescRow.getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hexToArgb("F5F5F5") },
        };
        cell.alignment = { horizontal: "left", vertical: "top" };
        if (col === 2) {
          // Column B: italic, wrap text
          cell.font = { size: 11, italic: true };
          cell.alignment = { ...cell.alignment, wrapText: true };
        }
      }
      rowTypes.set(currentRow, "description");
      currentRow++;
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
        const blankRow = worksheet.getRow(currentRow);
        for (let col = 1; col <= 6; col++) {
          const cell = blankRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: hexToArgb("F5F5F5") },
          };
          cell.alignment = { horizontal: "left", vertical: "top" };
        }
        rowTypes.set(currentRow, "blank");
        currentRow++;
      }

      // Level 2 hierarchy (column B only)
      const level2Row = worksheet.getRow(currentRow);
      level2Row.getCell(2).value = level2.title;
      for (let col = 1; col <= 6; col++) {
        const cell = level2Row.getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hexToArgb("F5F5F5") },
        };
        cell.alignment = { horizontal: "left", vertical: "top" };
        if (col === 2) {
          // Column B: bold and wrap text with appropriate font size
          cell.font = { bold: true, size: 14 };
          cell.alignment = { ...cell.alignment, wrapText: true };
        }
      }
      rowTypes.set(currentRow, "hierarchy");
      hierarchyLevels.set(currentRow, 2);
      currentRow++;

      // Level 2 description (column B only) if exists
      if (level2.description) {
        const level2DescRow = worksheet.getRow(currentRow);
        level2DescRow.getCell(2).value = level2.description;
        for (let col = 1; col <= 6; col++) {
          const cell = level2DescRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: hexToArgb("F5F5F5") },
          };
          cell.alignment = { horizontal: "left", vertical: "top" };
          if (col === 2) {
            // Column B: italic, wrap text
            cell.font = { size: 11, italic: true };
            cell.alignment = { ...cell.alignment, wrapText: true };
          }
        }
        rowTypes.set(currentRow, "description");
        currentRow++;
      }

      // Get requirements for this level 2 hierarchy
      const level2Requirements = hierarchyMap.get(level2.id) || [];
      level2Requirements.sort((a, b) => a.order - b.order);

      // Add requirement rows
      level2Requirements.forEach((req) => {
        const reqRow = worksheet.getRow(currentRow);
        reqRow.getCell(1).value = req.number; // Column A: Requirement number
        reqRow.getCell(2).value = req.description; // Column B: Requirement description
        reqRow.getCell(3).value = req.type; // Column C: Priority/Type
        reqRow.getCell(4).value = ""; // Column D: Answer
        reqRow.getCell(5).value = ""; // Column E: Description
        reqRow.getCell(6).value = ""; // Column F: Reference

        // Format requirement row
        // Column A: Requirement number
        const cellA = reqRow.getCell(1);
        if (cellA.value !== null && cellA.value !== undefined && cellA.value !== "") {
          cellA.font = { size: 11 };
          cellA.alignment = { horizontal: "left", vertical: "top" };
        }

        // Column B: Requirement description
        const cellB = reqRow.getCell(2);
        if (cellB.value !== null && cellB.value !== undefined && cellB.value !== "") {
          cellB.font = { size: 11 };
          cellB.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        }

        // Column C: Priority/Type
        const cellC = reqRow.getCell(3);
        if (cellC.value !== null && cellC.value !== undefined && cellC.value !== "") {
          cellC.font = { size: 11 };
          cellC.alignment = { horizontal: "left", vertical: "top" };
        }

        // Column D: Answer (will have data validation)
        const cellD = reqRow.getCell(4);
        cellD.font = { size: 11 };
        cellD.alignment = { horizontal: "center", vertical: "top" };

        // Column E: Description
        const cellE = reqRow.getCell(5);
        cellE.font = { size: 11 };
        cellE.alignment = { horizontal: "left", vertical: "top", wrapText: true };

        // Column F: Reference
        const cellF = reqRow.getCell(6);
        cellF.font = { size: 11 };
        cellF.alignment = { horizontal: "left", vertical: "top", wrapText: true };

        rowTypes.set(currentRow, "requirement");
        requirementRowNumbers.push(currentRow);
        currentRow++;
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
        const blankRow = worksheet.getRow(currentRow);
        for (let col = 1; col <= 6; col++) {
          const cell = blankRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: hexToArgb("F5F5F5") },
          };
          cell.alignment = { horizontal: "left", vertical: "top" };
        }
        rowTypes.set(currentRow, "blank");
        currentRow++;
      }

      level1Requirements.forEach((req) => {
        const reqRow = worksheet.getRow(currentRow);
        reqRow.getCell(1).value = req.number; // Column A: Requirement number
        reqRow.getCell(2).value = req.description; // Column B: Requirement description
        reqRow.getCell(3).value = req.type; // Column C: Priority/Type
        reqRow.getCell(4).value = ""; // Column D: Answer
        reqRow.getCell(5).value = ""; // Column E: Description
        reqRow.getCell(6).value = ""; // Column F: Reference

        // Format requirement row (same as above)
        // Column A: Requirement number
        const cellA = reqRow.getCell(1);
        if (cellA.value !== null && cellA.value !== undefined && cellA.value !== "") {
          cellA.font = { size: 11 };
          cellA.alignment = { horizontal: "left", vertical: "top" };
        }

        // Column B: Requirement description
        const cellB = reqRow.getCell(2);
        if (cellB.value !== null && cellB.value !== undefined && cellB.value !== "") {
          cellB.font = { size: 11 };
          cellB.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        }

        // Column C: Priority/Type
        const cellC = reqRow.getCell(3);
        if (cellC.value !== null && cellC.value !== undefined && cellC.value !== "") {
          cellC.font = { size: 11 };
          cellC.alignment = { horizontal: "left", vertical: "top" };
        }

        // Column D: Answer (will have data validation)
        const cellD = reqRow.getCell(4);
        cellD.font = { size: 11 };
        cellD.alignment = { horizontal: "center", vertical: "top" };

        // Column E: Description
        const cellE = reqRow.getCell(5);
        cellE.font = { size: 11 };
        cellE.alignment = { horizontal: "left", vertical: "top", wrapText: true };

        // Column F: Reference
        const cellF = reqRow.getCell(6);
        cellF.font = { size: 11 };
        cellF.alignment = { horizontal: "left", vertical: "top", wrapText: true };

        rowTypes.set(currentRow, "requirement");
        requirementRowNumbers.push(currentRow);
        currentRow++;
      });
    }
  });

  // Add formula in D2 to count blank cells in column D (from D5 down) where column A has a requirement number
  // Formula: COUNTIFS counts rows where A is not empty AND D is empty
  const lastRow = currentRow - 1; // Last row that was populated
  if (lastRow >= 5) {
    const cellD2 = worksheet.getRow(2).getCell(4); // Column D, Row 2
    cellD2.value = { formula: `COUNTIFS(A5:A${lastRow},"<>",D5:D${lastRow},"")` };
    cellD2.font = { size: 11 };
    cellD2.alignment = { horizontal: "center", vertical: "top" };
  }

  // Add data validation for column D (Yes/No/Partial) - only for requirement rows
  if (requirementRowNumbers.length > 0) {
    // Apply data validation to each requirement row's column D
    // ExcelJS list validation: formula should be a string with quoted comma-separated values
    requirementRowNumbers.forEach((rowNum) => {
      const cell = worksheet.getRow(rowNum).getCell(4); // Column D
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Yes,No,Partial"'],
        showInputMessage: true,
        showErrorMessage: true,
      };
    });
  }

  // Generate buffer
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    // writeBuffer returns Buffer in Node.js, but handle both Buffer and ArrayBuffer
    if (Buffer.isBuffer(buffer)) {
      return buffer;
    }
    // If it's an ArrayBuffer, convert to Buffer
    if (buffer instanceof ArrayBuffer) {
      return Buffer.from(buffer);
    }
    // Fallback: convert to Buffer
    return Buffer.from(buffer as any);
  } catch (error) {
    throw new Error(`Failed to generate Excel buffer: ${error instanceof Error ? error.message : String(error)}`);
  }
}
