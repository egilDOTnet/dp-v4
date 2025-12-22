import PDFDocument from "pdfkit";
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
 * Generate a PDF document for requirements
 * @param projectInfo - Project information
 * @param requirements - Array of approved requirements with hierarchy information
 * @returns PDFDocument stream
 */
export function generateRequirementsPDF(
  projectInfo: ProjectInfo,
  requirements: RequirementWithHierarchy[]
): PDFDocument {
  // Create PDF document with A4 page size (595.28 x 841.89 points)
  const doc = new PDFDocument({ 
    size: 'A4', // A4 dimensions: 595.28 x 841.89 points (width x height)
    margin: 50 
  });
  
  // Helper to get hierarchy path (e.g., "1.2" for level 2 under level 1)
  const getHierarchyPath = (hierarchy: RequirementHierarchy & { parent?: RequirementHierarchy | null }): string => {
    if (hierarchy.parent) {
      // Remove trailing periods and combine
      const parentNum = hierarchy.parent.number.endsWith('.') ? hierarchy.parent.number.slice(0, -1) : hierarchy.parent.number;
      const childNum = hierarchy.number.endsWith('.') ? hierarchy.number.slice(0, -1) : hierarchy.number;
      return `${parentNum}.${childNum}`;
    }
    return hierarchy.number;
  };

  // Build TOC from hierarchies
  const hierarchyMap = new Map<string, RequirementHierarchy & { parent?: RequirementHierarchy | null }>();
  const level1Hierarchies: (RequirementHierarchy & { parent?: RequirementHierarchy | null })[] = [];
  const level1HierarchyIds = new Set<string>();
  
  requirements.forEach((req) => {
    const hierarchy = req.hierarchy;
    
    // Add the hierarchy itself to the map
    if (!hierarchyMap.has(hierarchy.id)) {
      hierarchyMap.set(hierarchy.id, hierarchy);
    }
    
    // If this is a level 1 hierarchy (no parent), add it to level1Hierarchies
    if (!hierarchy.parent) {
      if (!level1HierarchyIds.has(hierarchy.id)) {
        level1Hierarchies.push(hierarchy);
        level1HierarchyIds.add(hierarchy.id);
      }
    } else {
      // This is a level 2 hierarchy - add its parent (level 1) to level1Hierarchies
      const parentHierarchy = hierarchy.parent;
      if (parentHierarchy && !level1HierarchyIds.has(parentHierarchy.id)) {
        level1Hierarchies.push(parentHierarchy);
        level1HierarchyIds.add(parentHierarchy.id);
        // Also add parent to hierarchyMap if not already there
        if (!hierarchyMap.has(parentHierarchy.id)) {
          hierarchyMap.set(parentHierarchy.id, parentHierarchy);
        }
      }
    }
  });

  // Sort level 1 hierarchies by order
  level1Hierarchies.sort((a, b) => a.order - b.order);

  // FRONT PAGE
  doc.fontSize(24).font("Helvetica-Bold").text(projectInfo.name, { align: "center" });
  doc.moveDown(2);
  doc.fontSize(18).font("Helvetica-Bold").text("Requirements", { align: "center" });
  doc.moveDown(3);

  // Table of Contents
  doc.fontSize(14).font("Helvetica-Bold").text("Table of Contents", { align: "left" });
  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica");

  let tocY = doc.y;
  level1Hierarchies.forEach((level1) => {
    // Remove any trailing period from the number for display
    const level1Number = level1.number.endsWith('.') ? level1.number.slice(0, -1) : level1.number;
    doc.text(`${level1Number} ${level1.title}`, 70, tocY);
    tocY += 20;

    // Add level 2 hierarchies under this level 1
    const level2Hierarchies = Array.from(hierarchyMap.values())
      .filter((h) => h.parent?.id === level1.id)
      .sort((a, b) => a.order - b.order);

    level2Hierarchies.forEach((level2) => {
      const level2Path = getHierarchyPath(level2);
      // Remove any trailing period from the path for display
      const level2Number = level2Path.endsWith('.') ? level2Path.slice(0, -1) : level2Path;
      doc.fontSize(10).text(`  ${level2Number} ${level2.title}`, 90, tocY);
      tocY += 18;
    });
  });

  // CONTENT PAGES
  // Add page break before first level 1 hierarchy
  if (level1Hierarchies.length > 0) {
    doc.addPage();
  }
  
  level1Hierarchies.forEach((level1, level1Index) => {
    if (level1Index > 0) {
      doc.addPage();
    }

    // Reset X position to left margin before rendering level 1 header
    doc.x = 70;
    
    // Level 1 Header
    // Remove any trailing period from the number for display
    const level1Number = level1.number.endsWith('.') ? level1.number.slice(0, -1) : level1.number;
    doc.fontSize(16).font("Helvetica-Bold").text(`${level1Number} ${level1.title}`);
    doc.moveDown(0.5);

    // Level 1 Description
    if (level1.description) {
      doc.x = 70; // Reset X position for description
      doc.fontSize(11).font("Helvetica").text(level1.description);
      doc.moveDown(1);
    }

    // Get level 2 hierarchies for this level 1
    const level2Hierarchies = Array.from(hierarchyMap.values())
      .filter((h) => h.parent?.id === level1.id)
      .sort((a, b) => a.order - b.order);

    level2Hierarchies.forEach((level2) => {
      // Get requirements for this level 2 hierarchy
      const level2Requirements = requirements
        .filter((req) => req.hierarchy.id === level2.id)
        .sort((a, b) => a.order - b.order);

      if (level2Requirements.length > 0) {
        // Calculate space needed more accurately:
        // Line break (12pt) + level 2 header (14pt) + spacing (7pt) + 
        // description (if exists, ~20pt + 12pt spacing) + 
        // table header text (10pt) + hr line (15pt) + spacing (12pt) + 
        // first requirement row (minimum 20pt)
        let estimatedSpace = 12; // Line break before level 2
        estimatedSpace += 14 + 7; // Header + spacing
        if (level2.description) {
          estimatedSpace += 20 + 12; // Description + spacing
        }
        estimatedSpace += 10 + 15 + 12; // Table header text + hr line + spacing
        estimatedSpace += 20; // First requirement row (minimum)
        
        // Check if we need a new page BEFORE the level 2 header
        // If there's not enough space for all of the above, break before rendering
        if (doc.y + estimatedSpace > 750) {
          doc.addPage();
        }

        // Add line break before level 2 hierarchy to detach from content above
        doc.moveDown(1);
      } else {
        // No requirements, just check basic page break
        if (doc.y > 700) {
          doc.addPage();
        }
        // Add line break before level 2 hierarchy
        doc.moveDown(1);
      }

      // Reset X position to left margin before rendering level 2 header
      doc.x = 70;
      
      // Level 2 Header - render on a new line, aligned left
      const level2Path = getHierarchyPath(level2);
      // Remove any trailing period from the path for display
      const level2Number = level2Path.endsWith('.') ? level2Path.slice(0, -1) : level2Path;
      doc.fontSize(14).font("Helvetica-Bold").text(`${level2Number} ${level2.title}`);
      doc.moveDown(0.5);

      // Level 2 Description
      if (level2.description) {
        doc.x = 70; // Reset X position for description
        doc.fontSize(10).font("Helvetica").text(level2.description);
        doc.moveDown(1);
      }

      if (level2Requirements.length > 0) {

        // Table header
        const startY = doc.y;
        const col1X = 70;
        const col2X = 150;
        const col3X = 450;
        const headerY = startY;

        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Req. #", col1X, headerY);
        doc.text("Requirement", col2X, headerY);
        doc.text("Type", col3X, headerY);

        // Draw header line
        doc.moveTo(70, headerY + 15).lineTo(550, headerY + 15).stroke();
        doc.moveDown(1);

        // Requirements rows
        doc.fontSize(9).font("Helvetica");
        level2Requirements.forEach((req) => {
          // Calculate row height FIRST to check if it fits on current page
          const reqNumber = req.number.endsWith('.') ? req.number.slice(0, -1) : req.number;
          const numberHeight = doc.heightOfString(reqNumber || "", { width: 70 });
          const descriptionHeight = doc.heightOfString(req.description || "", { width: 280 });
          const typeHeight = doc.heightOfString(req.type || "", { width: 100 });
          const rowHeight = Math.max(numberHeight, descriptionHeight, typeHeight, 15); // Minimum 15pt
          const rowSpacing = 5;
          const totalRowHeight = rowHeight + rowSpacing;

          // Check if the entire row fits on the current page
          // If not, move to next page and redraw table header
          if (doc.y + totalRowHeight > 750) {
            doc.addPage();
            doc.fontSize(10).font("Helvetica-Bold");
            const headerY = doc.y;
            doc.text("Req. #", col1X, headerY);
            doc.text("Requirement", col2X, headerY);
            doc.text("Type", col3X, headerY);
            doc.moveTo(70, headerY + 15).lineTo(550, headerY + 15).stroke();
            doc.moveDown(1);
          }

          // Save the starting Y position for this row
          const rowStartY = doc.y;

          // Position all three columns at the same Y coordinate (top-aligned)
          // Number column
          doc.text(reqNumber, col1X, rowStartY, { width: 70, align: "left" });

          // Requirement description (wrapped)
          doc.text(req.description, col2X, rowStartY, { width: 280, align: "left" });

          // Type column
          doc.text(req.type, col3X, rowStartY, { width: 100, align: "left" });

          // Move down by the row height plus some spacing
          doc.y = rowStartY + totalRowHeight;
        });
      }
    });

    // Handle requirements directly under level 1 (if any) - after all level 2 hierarchies
    const level1Requirements = requirements
      .filter((req) => req.hierarchy.id === level1.id && !req.hierarchy.parent)
      .sort((a, b) => a.order - b.order);

    if (level1Requirements.length > 0) {
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage();
      }

      // Table header
      const startY = doc.y;
      const col1X = 70;
      const col2X = 150;
      const col3X = 450;

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Req. #", col1X, startY);
      doc.text("Requirement", col2X, startY);
      doc.text("Type", col3X, startY);

      // Draw header line
      doc.moveTo(70, startY + 15).lineTo(550, startY + 15).stroke();
      doc.moveDown(1);

      // Requirements rows
      doc.fontSize(9).font("Helvetica");
      level1Requirements.forEach((req) => {
        // Calculate row height FIRST to check if it fits on current page
        const reqNumber = req.number.endsWith('.') ? req.number.slice(0, -1) : req.number;
        const numberHeight = doc.heightOfString(reqNumber || "", { width: 70 });
        const descriptionHeight = doc.heightOfString(req.description || "", { width: 280 });
        const typeHeight = doc.heightOfString(req.type || "", { width: 100 });
        const rowHeight = Math.max(numberHeight, descriptionHeight, typeHeight, 15); // Minimum 15pt
        const rowSpacing = 5;
        const totalRowHeight = rowHeight + rowSpacing;

        // Check if the entire row fits on the current page
        // If not, move to next page and redraw table header
        if (doc.y + totalRowHeight > 750) {
          doc.addPage();
          doc.fontSize(10).font("Helvetica-Bold");
          const headerY = doc.y;
          doc.text("Req. #", col1X, headerY);
          doc.text("Requirement", col2X, headerY);
          doc.text("Type", col3X, headerY);
          doc.moveTo(70, headerY + 15).lineTo(550, headerY + 15).stroke();
          doc.moveDown(1);
        }

        // Save the starting Y position for this row
        const rowStartY = doc.y;

        // Position all three columns at the same Y coordinate (top-aligned)
        // Number column
        doc.text(reqNumber, col1X, rowStartY, { width: 70, align: "left" });

        // Requirement description (wrapped)
        doc.text(req.description, col2X, rowStartY, { width: 280, align: "left" });

        // Type column
        doc.text(req.type, col3X, rowStartY, { width: 100, align: "left" });

        // Move down by the row height plus some spacing
        doc.y = rowStartY + totalRowHeight;
      });
    }
  });

  return doc;
}

