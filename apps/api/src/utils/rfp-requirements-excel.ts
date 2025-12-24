import ExcelJS from "exceljs";
import { RequirementAnswer } from "@prisma/client";

export interface ParsedRequirementResponse {
  requirementNumber: string;
  answer: RequirementAnswer | null;
  description: string | null;
  reference: string | null;
}

export interface InvalidAnswer {
  requirementNumber: string;
  invalidValue: string;
  row: number;
}

export interface ParseResult {
  responses: ParsedRequirementResponse[];
  invalidAnswers: InvalidAnswer[];
  totalRequirements: number;
  answeredCount: number;
  percentage: number;
}

export interface ColumnMapping {
  requirementNumber: number; // column index (0-based)
  answer: number;
  description: number;
  reference: number;
}

export interface AvailableColumn {
  index: number;
  header: string;
  sampleValues: string[];
}

export interface ColumnDetectionResult {
  needsMapping: boolean;
  mapping?: ColumnMapping;
  availableColumns?: AvailableColumn[];
}

/**
 * Detect column structure from Excel file
 * Scans first few rows to identify potential column positions
 * Returns detected column indices or null if cannot be auto-detected
 */
export async function detectColumnStructure(buffer: Buffer): Promise<ColumnDetectionResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file must contain at least one worksheet");
  }

  // Check if standard format (columns A, D, E, F)
  // Try to parse first few rows to see if it matches expected format
  let hasStandardFormat = false;
  let detectedMapping: ColumnMapping | undefined;

  // Check rows 1-10 for header patterns
  const headerRows = Math.min(5, worksheet.rowCount);
  for (let rowNum = 1; rowNum <= headerRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    // Check if row 4 matches standard headers (Req. #, Requirement, Priority, Answer, Description, Reference)
    if (rowNum === 4) {
      const cell1 = row.getCell(1).value;
      const cell4 = row.getCell(4).value;
      const cell5 = row.getCell(5).value;
      const cell6 = row.getCell(6).value;
      
      const cell1Str = cell1 && typeof cell1 === "string" ? cell1.trim().toLowerCase() : "";
      const cell4Str = cell4 && typeof cell4 === "string" ? cell4.trim().toLowerCase() : "";
      const cell5Str = cell5 && typeof cell5 === "string" ? cell5.trim().toLowerCase() : "";
      const cell6Str = cell6 && typeof cell6 === "string" ? cell6.trim().toLowerCase() : "";
      
      // Check for standard headers (case-insensitive)
      if (
        (cell1Str.includes("req") || cell1Str.includes("#")) &&
        (cell4Str === "answer" || cell4Str.includes("answer")) &&
        (cell5Str === "description" || cell5Str.includes("desc")) &&
        (cell6Str === "reference" || cell6Str.includes("ref"))
      ) {
        hasStandardFormat = true;
        detectedMapping = {
          requirementNumber: 0, // Column A (0-based: column 1 - 1)
          answer: 3, // Column D (0-based: column 4 - 1)
          description: 4, // Column E (0-based: column 5 - 1)
          reference: 5, // Column F (0-based: column 6 - 1)
        };
        break;
      }
    }
  }

  // If standard format detected, return it
  if (hasStandardFormat && detectedMapping) {
    return {
      needsMapping: false,
      mapping: detectedMapping,
    };
  }

  // Otherwise, collect available columns for mapping
  const availableColumns: AvailableColumn[] = [];
  const maxCols = 20; // Check up to 20 columns

  // Get headers from first few rows
  const headerRow = worksheet.getRow(headerRows);
  const sampleRows: number[] = [];
  for (let i = headerRows + 1; i <= Math.min(headerRows + 5, worksheet.rowCount); i++) {
    sampleRows.push(i);
  }

  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const colNum = colIdx + 1; // Excel columns are 1-based
    const headerCell = headerRow.getCell(colNum).value;
    const header = headerCell && typeof headerCell === "string" ? headerCell.trim() : `Column ${String.fromCharCode(64 + colNum)}`;
    
    const sampleValues: string[] = [];
    for (const rowNum of sampleRows) {
      const cell = worksheet.getRow(rowNum).getCell(colNum).value;
      if (cell !== null && cell !== undefined) {
        sampleValues.push(String(cell).substring(0, 50)); // Limit length
      }
    }

    // Only add column if it has a header or sample values
    if (headerCell || sampleValues.length > 0) {
      availableColumns.push({
        index: colIdx,
        header,
        sampleValues,
      });
    }
  }

  return {
    needsMapping: true,
    availableColumns,
  };
}

/**
 * Parse uploaded Excel file for requirements responses with column mapping
 * @param buffer - Excel file buffer
 * @param columnMapping - Column mapping (0-based indices)
 * @param startRow - Starting row number (1-based, default 5 for standard format)
 * @returns Parsed requirement responses with statistics and invalid answers
 */
export async function parseRequirementsExcelWithMapping(
  buffer: Buffer,
  columnMapping: ColumnMapping,
  startRow: number = 5
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file must contain at least one worksheet");
  }

  const responses: ParsedRequirementResponse[] = [];
  const invalidAnswers: InvalidAnswer[] = [];
  let totalRequirements = 0;
  let answeredCount = 0;

  for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    
    // Get requirement number from mapped column (convert 0-based to 1-based)
    const requirementNumberCell = row.getCell(columnMapping.requirementNumber + 1);
    const requirementNumber = requirementNumberCell.value;
    
    // Skip rows without requirement numbers
    if (!requirementNumber || typeof requirementNumber !== "string") {
      continue;
    }

    const reqNumber = requirementNumber.trim();
    if (reqNumber === "") {
      continue;
    }

    totalRequirements++;

    // Get answer from mapped column
    const answerCell = row.getCell(columnMapping.answer + 1);
    const answerValue = answerCell.value;
    let answer: RequirementAnswer | null = null;
    
    if (answerValue && typeof answerValue === "string") {
      const normalizedAnswer = answerValue.trim();
      // Validate answer is one of the allowed values (case-insensitive)
      const normalizedLower = normalizedAnswer.toLowerCase();
      if (normalizedLower === "yes") {
        answer = RequirementAnswer.Yes;
        answeredCount++;
      } else if (normalizedLower === "no") {
        answer = RequirementAnswer.No;
        answeredCount++;
      } else if (normalizedLower === "partial") {
        answer = RequirementAnswer.Partial;
        answeredCount++;
      } else if (normalizedLower === "development") {
        answer = RequirementAnswer.Development;
        answeredCount++;
      } else if (normalizedAnswer !== "") {
        // Invalid answer value - collect it but don't throw
        invalidAnswers.push({
          requirementNumber: reqNumber,
          invalidValue: normalizedAnswer,
          row: rowNum,
        });
        // Skip this row (don't include in responses)
        continue;
      }
    }

    // Get description from mapped column
    const descriptionCell = row.getCell(columnMapping.description + 1);
    const descriptionValue = descriptionCell.value;
    const description = descriptionValue && typeof descriptionValue === "string" 
      ? descriptionValue.trim() || null 
      : null;

    // Get reference from mapped column
    const referenceCell = row.getCell(columnMapping.reference + 1);
    const referenceValue = referenceCell.value;
    const reference = referenceValue && typeof referenceValue === "string"
      ? referenceValue.trim() || null
      : null;

    // Only include responses that have at least an answer
    if (answer !== null) {
      responses.push({
        requirementNumber: reqNumber,
        answer,
        description,
        reference,
      });
    }
  }

  const percentage = totalRequirements > 0 
    ? Math.round((answeredCount / totalRequirements) * 100) 
    : 0;

  return {
    responses,
    invalidAnswers,
    totalRequirements,
    answeredCount,
    percentage,
  };
}

/**
 * Parse uploaded Excel file for requirements responses (standard format)
 * Validates format matches generated Excel structure
 * Extracts answers from columns D-F (Answer, Description, Reference)
 * Maps by requirement number (column A)
 * @param buffer - Excel file buffer
 * @returns Parsed requirement responses with statistics
 */
export async function parseRequirementsExcel(buffer: Buffer): Promise<ParseResult> {
  // Use standard column mapping (A=0, D=3, E=4, F=5, 0-based)
  return parseRequirementsExcelWithMapping(
    buffer,
    {
      requirementNumber: 0, // Column A
      answer: 3, // Column D
      description: 4, // Column E
      reference: 5, // Column F
    },
    5 // Start from row 5 (standard format)
  );
}

