"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui";

export type ImportDataType = "tasks" | "rfi-questions" | "requirements";

interface ImportHelpDialogProps {
  dataType: ImportDataType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HELP_CONTENT: Record<ImportDataType, {
  title: string;
  description: string;
  requiredFields: Array<{ name: string; description: string }>;
  optionalFields?: Array<{ name: string; description: string }>;
  exampleHeaders: string[];
  exampleRows: string[][];
  notes?: string[];
}> = {
  "tasks": {
    title: "Import Tasks",
    description: "Import tasks from a CSV file. Each row will create a new task in the selected phase.",
    requiredFields: [
      { name: "name", description: "The task name (required)" }
    ],
    exampleHeaders: ["name"],
    exampleRows: [
      ["Review vendor proposals"],
      ["Schedule meetings with top candidates"],
      ["Document evaluation criteria"]
    ],
    notes: [
      "Tasks will be imported in the order they appear in the CSV file.",
      "You will be asked to select a phase during the import process."
    ]
  },
  "rfi-questions": {
    title: "Import RFI Questions",
    description: "Import RFI questions from a CSV file. Each row will create a new question in the RFI questionnaire.",
    requiredFields: [
      { name: "title", description: "The question title (required)" }
    ],
    exampleHeaders: ["title"],
    exampleRows: [
      ["What is your company's annual revenue?"],
      ["How many employees does your company have?"],
      ["What is your primary service area?"]
    ],
    notes: [
      "All imported questions will be set as not required by default.",
      "All imported questions will use the 'Single Text' question type.",
      "Questions will be imported in the order they appear in the CSV file."
    ]
  },
  "requirements": {
    title: "Import Requirements + Hierarchy",
    description: "Import requirements with their hierarchy structure from a CSV file. Supports two-level hierarchy.",
    requiredFields: [
      { name: "level1", description: "Level 1 hierarchy title (required)" },
      { name: "requirement", description: "Requirement description (required)" }
    ],
    optionalFields: [
      { name: "level2", description: "Level 2 hierarchy title (optional - creates sub-hierarchy under level 1)" },
      { name: "type", description: "Requirement type (optional - valid values: Information, Mandatory, Important, Wish. Default: Information)" }
    ],
    exampleHeaders: ["level1", "level2", "requirement", "type"],
    exampleRows: [
      ["Security", "Authentication", "System must support multi-factor authentication", "Mandatory"],
      ["Security", "Encryption", "All data must be encrypted at rest", "Mandatory"],
      ["Performance", "", "System must handle 1000 concurrent users", "Important"],
      ["Compliance", "GDPR", "System must comply with GDPR requirements", "Mandatory"]
    ],
    notes: [
      "Requirements will be imported with status 'Imported'.",
      "If level2 is provided, a sub-hierarchy will be created under the level1 hierarchy.",
      "If level2 is empty, the requirement will be created directly under level1.",
      "Type field accepts: Information, Mandatory, Important, or Wish. If not provided or invalid, defaults to Information.",
      "Requirements will be imported in the order they appear in the CSV file."
    ]
  }
};

export const ImportHelpDialog: React.FC<ImportHelpDialogProps> = ({
  dataType,
  open,
  onOpenChange,
}) => {
  const content = HELP_CONTENT[dataType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Required Fields */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Required Fields
            </h3>
            <ul className="space-y-2">
              {content.requiredFields.map((field) => (
                <li key={field.name} className="text-sm">
                  <span className="font-medium text-text-primary">{field.name}</span>
                  <span className="text-text-secondary ml-2">- {field.description}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Fields */}
          {content.optionalFields && content.optionalFields.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Optional Fields
              </h3>
              <ul className="space-y-2">
                {content.optionalFields.map((field) => (
                  <li key={field.name} className="text-sm">
                    <span className="font-medium text-text-primary">{field.name}</span>
                    <span className="text-text-secondary ml-2">- {field.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Example CSV Format */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Example CSV Format
            </h3>
            <div className="bg-background-secondary rounded-md p-4 overflow-x-auto">
              <table className="text-sm font-mono">
                <thead>
                  <tr className="border-b border-border-primary">
                    {content.exampleHeaders.map((header, idx) => (
                      <th key={idx} className="px-3 py-2 text-left font-semibold text-text-primary">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {content.exampleRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border-primary">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-3 py-2 text-text-secondary">
                          {cell || <span className="text-text-tertiary italic">(empty)</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {content.notes && content.notes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Notes
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                {content.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

