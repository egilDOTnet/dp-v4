"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { Button } from "@/components/ui/FormField";

export interface AvailableColumn {
  index: number;
  header: string;
  sampleValues: string[];
}

export interface ColumnMapping {
  requirementNumber: number;
  answer: number;
  description: number;
  reference: number;
}

interface RequirementsColumnMappingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (mapping: ColumnMapping) => void;
  availableColumns: AvailableColumn[];
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  requirementNumber: "Req. #",
  answer: "Answer",
  description: "Description",
  reference: "Reference",
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["requirementNumber", "answer"];

export function RequirementsColumnMappingDialog({
  open,
  onClose,
  onConfirm,
  availableColumns,
}: RequirementsColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({
    requirementNumber: undefined,
    answer: undefined,
    description: undefined,
    reference: undefined,
  });
  const [error, setError] = useState("");

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    if (value === "") {
      const newMapping = { ...mapping };
      delete newMapping[field];
      setMapping(newMapping);
    } else {
      setMapping({ ...mapping, [field]: parseInt(value, 10) });
    }
    setError("");
  };

  const handleConfirm = () => {
    // Validate required fields
    const missingFields = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);
    if (missingFields.length > 0) {
      setError(`Please map all required fields: ${missingFields.map((f) => FIELD_LABELS[f]).join(", ")}`);
      return;
    }

    // Validate that all mapped columns are unique
    const mappedIndices = Object.values(mapping).filter((v) => v !== undefined) as number[];
    const uniqueIndices = new Set(mappedIndices);
    if (mappedIndices.length !== uniqueIndices.size) {
      setError("Each column can only be mapped to one field");
      return;
    }

    onConfirm(mapping as ColumnMapping);
  };

  const getPreviewRows = () => {
    const rows: string[][] = [];
    const maxPreviewRows = Math.min(3, availableColumns[0]?.sampleValues.length || 0);
    
    for (let rowIdx = 0; rowIdx < maxPreviewRows; rowIdx++) {
      const row: string[] = [];
      for (const col of availableColumns) {
        const value = col.sampleValues[rowIdx] || "";
        // Truncate to 30 characters
        const truncated = value.length > 30 ? value.substring(0, 30) + "..." : value;
        row.push(truncated);
      }
      rows.push(row);
    }
    
    return rows;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Map Excel Columns</DialogTitle>
          <DialogDescription>
            Please map the columns in your Excel file to the required fields. At minimum, you must map "Req. #" and "Answer".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4 flex-1 flex flex-col min-h-0">
          <div className="space-y-3 flex-shrink-0">
            {(Object.keys(FIELD_LABELS) as Array<keyof ColumnMapping>).map((field) => {
              const isRequired = REQUIRED_FIELDS.includes(field);
              return (
                <div key={field} className="flex items-center space-x-3">
                  <label className="w-40 text-sm font-medium text-text-primary">
                    {FIELD_LABELS[field]} {isRequired && <span className="text-red-600">*</span>}
                  </label>
                  <select
                    value={mapping[field]?.toString() || ""}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="flex-1 px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select column...</option>
                    {availableColumns.map((col) => {
                      const truncatedHeader = col.header.length > 30 
                        ? col.header.substring(0, 30) + "..." 
                        : col.header;
                      return (
                        <option key={col.index} value={col.index.toString()}>
                          {truncatedHeader} (Col. {String.fromCharCode(65 + col.index)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex-shrink-0">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-4 flex-1 flex flex-col min-h-0">
            <h4 className="text-sm font-medium text-text-primary mb-2 flex-shrink-0">Preview (first 3 rows):</h4>
            <div className="bg-background-secondary rounded-md p-4 overflow-auto flex-1 min-h-0">
              <table className="text-sm">
                <thead>
                  <tr className="border-b border-border-primary">
                    {availableColumns.map((col) => (
                      <th
                        key={col.index}
                        className="px-3 py-2 text-left font-semibold text-text-primary whitespace-nowrap"
                      >
                        Col. {String.fromCharCode(65 + col.index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getPreviewRows().map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border-primary">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-3 py-2 text-text-secondary whitespace-nowrap">
                          <div className="max-w-xs truncate" title={cell || "(empty)"}>
                            {cell || <span className="text-text-tertiary italic">(empty)</span>}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

