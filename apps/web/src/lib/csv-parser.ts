/**
 * CSV Parser Utility
 * Handles CSV file parsing with automatic delimiter detection and Unicode support
 */

export interface ParseCSVResult {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

/**
 * Detects the delimiter used in a CSV file
 * Checks for comma, semicolon, and tab
 */
function detectDelimiter(text: string): string {
  const lines = text.split('\n').slice(0, 10); // Check first 10 lines
  const delimiters = [',', ';', '\t'];
  
  let bestDelimiter = ',';
  let maxCount = 0;

  for (const delimiter of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    
    if (avgCount > maxCount) {
      maxCount = avgCount;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Parses a CSV line, handling quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}

/**
 * Removes BOM (Byte Order Mark) from UTF-8 text
 */
function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Parses a CSV file
 * @param file - The CSV file to parse
 * @returns Promise with headers, rows, and detected delimiter
 */
export async function parseCSV(file: File): Promise<ParseCSVResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        if (!text) {
          reject(new Error('File is empty'));
          return;
        }

        // Remove BOM if present
        text = removeBOM(text);

        // Normalize line endings
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Detect delimiter
        const delimiter = detectDelimiter(text);

        // Split into lines
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        // Parse headers
        const headers = parseCSVLine(lines[0], delimiter);

        // Parse rows
        const rows: string[][] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i], delimiter);
          // Ensure row has same number of columns as headers (pad with empty strings if needed)
          while (row.length < headers.length) {
            row.push('');
          }
          // Trim to header length if too long
          if (row.length > headers.length) {
            row.splice(headers.length);
          }
          rows.push(row);
        }

        resolve({
          headers,
          rows,
          delimiter,
        });
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // Read as text with UTF-8 encoding
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Validates that a file is a CSV file
 */
export function validateCSVFile(file: File): boolean {
  const validExtensions = ['.csv', '.txt'];
  const validMimeTypes = ['text/csv', 'text/plain', 'application/csv'];
  
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const isValidExtension = validExtensions.includes(extension);
  const isValidMimeType = validMimeTypes.includes(file.type) || file.type === '';
  
  return isValidExtension || isValidMimeType;
}

