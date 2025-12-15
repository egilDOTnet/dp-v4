"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, validateCSVFile, ParseCSVResult } from "@/lib/csv-parser";
import { ImportHelpDialog, ImportDataType } from "./ImportHelpDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, LoadingSpinner } from "@/components/ui";
import { api, Phase } from "@/lib/api";

interface ImportWizardProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (count: number, dataType: ImportDataType) => void;
}

type WizardStep = "select-type" | "select-file" | "select-phase" | "map-columns" | "review" | "importing" | "success";

const DATA_TYPE_LABELS: Record<ImportDataType, string> = {
  "tasks": "Tasks",
  "rfi-questions": "RFI Questionnaires",
  "requirements": "Requirements + Hierarchy",
};

const FIELD_LABELS: Record<ImportDataType, Record<string, string>> = {
  "tasks": {
    "name": "Task Name",
  },
  "rfi-questions": {
    "title": "Question Title",
  },
  "requirements": {
    "level1": "Level 1 Hierarchy",
    "level2": "Level 2 Hierarchy",
    "requirement": "Requirement Description",
    "type": "Requirement Type",
  },
};

// Required fields for each data type
const REQUIRED_FIELDS: Record<ImportDataType, string[]> = {
  "tasks": ["name"],
  "rfi-questions": ["title"],
  "requirements": ["level1", "requirement"],
};

export const ImportWizard: React.FC<ImportWizardProps> = ({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("select-type");
  const [dataType, setDataType] = useState<ImportDataType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParseCSVResult | null>(null);
  const [skipFirstLine, setSkipFirstLine] = useState(true);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importCount, setImportCount] = useState(0);
  const [skippedRowsCount, setSkippedRowsCount] = useState(0);
  const [helpDataType, setHelpDataType] = useState<ImportDataType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load phases when dataType is "tasks"
  useEffect(() => {
    if (dataType === "tasks" && open) {
      api.projects.phases.list(projectId)
        .then(setPhases)
        .catch((err) => {
          setError(`Failed to load phases: ${err.message}`);
        });
    }
  }, [dataType, projectId, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("select-type");
      setDataType(null);
      setFile(null);
      setCsvData(null);
      setSkipFirstLine(true);
      setColumnMapping({});
      setSelectedPhaseId("");
      setError("");
      setImportCount(0);
      setSkippedRowsCount(0);
    }
  }, [open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isCsvLike =
      selectedFile.type === "text/csv" ||
      selectedFile.name.toLowerCase().endsWith(".csv") ||
      selectedFile.name.toLowerCase().endsWith(".txt");

    if (!isCsvLike || !validateCSVFile(selectedFile)) {
      setError("Please select a valid CSV file (.csv or .txt)");
      return;
    }

    setFile(selectedFile);
    setError("");
    setLoading(true);
    setColumnMapping({});

    try {
      const parsed = await parseCSV(selectedFile);
      setCsvData(parsed);
      setStep(dataType === "tasks" ? "select-phase" : "map-columns");
    } catch (err: any) {
      setError(`Failed to parse CSV: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSkippedRows = () => {
    if (!csvData || !dataType) return 0;

    const rowsToImport = skipFirstLine ? csvData.rows : [csvData.headers, ...csvData.rows];
    let skippedCount = 0;

    for (const row of rowsToImport) {
      let isValid = false;
      
      if (dataType === "tasks") {
        const nameCol = columnMapping["name"];
        if (nameCol && nameCol !== "skip" && row[parseInt(nameCol)]) {
          const nameValue = row[parseInt(nameCol)]?.trim() || "";
          if (nameValue) {
            isValid = true;
          }
        }
      } else if (dataType === "rfi-questions") {
        const titleCol = columnMapping["title"];
        if (titleCol && titleCol !== "skip" && row[parseInt(titleCol)]) {
          const titleValue = row[parseInt(titleCol)]?.trim() || "";
          if (titleValue) {
            isValid = true;
          }
        }
      } else if (dataType === "requirements") {
        const level1Col = columnMapping["level1"];
        const requirementCol = columnMapping["requirement"];

        // Check if required columns are mapped
        if (level1Col && level1Col !== "skip" && requirementCol && requirementCol !== "skip") {
          const level1Value = row[parseInt(level1Col)]?.trim() || "";
          const requirementValue = row[parseInt(requirementCol)]?.trim() || "";
          
          // Both level1 and requirement are required and must not be blank
          if (level1Value && requirementValue) {
            isValid = true;
          }
        }
      }

      if (!isValid) {
        skippedCount++;
      }
    }

    return skippedCount;
  };

  const handleNext = () => {
    if (step === "select-type") {
      if (!dataType) {
        setError("Please select a data type");
        return;
      }
      setStep("select-file");
    } else if (step === "select-phase") {
      if (!selectedPhaseId) {
        setError("Please select a phase");
        return;
      }
      setStep("map-columns");
    } else if (step === "map-columns") {
      // Validate mapping - only check required fields
      if (dataType) {
        const requiredFields = REQUIRED_FIELDS[dataType];
        const missingFields = requiredFields.filter(
          (field) => !columnMapping[field] || columnMapping[field] === "skip"
        );
        if (missingFields.length > 0) {
          setError(`Please map all required fields: ${missingFields.join(", ")}`);
          return;
        }
      }
      // Calculate skipped rows before moving to review
      const skipped = calculateSkippedRows();
      setSkippedRowsCount(skipped);
      setStep("review");
    } else if (step === "review") {
      handleImport();
    }
  };

  const handleBack = () => {
    if (step === "select-file") {
      setStep("select-type");
    } else if (step === "select-phase") {
      setStep("select-file");
    } else if (step === "map-columns") {
      setStep(dataType === "tasks" ? "select-phase" : "select-file");
    } else if (step === "review") {
      setStep("map-columns");
    }
    setError("");
  };

  const handleImport = async () => {
    if (!csvData || !dataType) return;

    setStep("importing");
    setError("");
    setLoading(true);

    try {
      // Prepare data based on mapping
      const rowsToImport = skipFirstLine ? csvData.rows : [csvData.headers, ...csvData.rows];
      const dataToImport: any[] = [];
      let skippedCount = 0;

      for (const row of rowsToImport) {
        const item: any = {};
        let isValid = false;
        
        if (dataType === "tasks") {
          const nameCol = columnMapping["name"];
          if (nameCol && nameCol !== "skip" && row[parseInt(nameCol)]) {
            const nameValue = row[parseInt(nameCol)]?.trim() || "";
            if (nameValue) {
              item.name = nameValue;
              isValid = true;
            }
          }
        } else if (dataType === "rfi-questions") {
          const titleCol = columnMapping["title"];
          if (titleCol && titleCol !== "skip" && row[parseInt(titleCol)]) {
            const titleValue = row[parseInt(titleCol)]?.trim() || "";
            if (titleValue) {
              item.title = titleValue;
              isValid = true;
            }
          }
        } else if (dataType === "requirements") {
          const level1Col = columnMapping["level1"];
          const level2Col = columnMapping["level2"];
          const requirementCol = columnMapping["requirement"];
          const typeCol = columnMapping["type"];

          // Check if required columns are mapped
          if (level1Col && level1Col !== "skip" && requirementCol && requirementCol !== "skip") {
            const level1Value = row[parseInt(level1Col)]?.trim() || "";
            const requirementValue = row[parseInt(requirementCol)]?.trim() || "";
            
            // Both level1 and requirement are required and must not be blank
            if (level1Value && requirementValue) {
              item.level1 = level1Value;
              // Only include level2 if it's mapped and has a value
              if (level2Col && level2Col !== "skip") {
                const level2Value = row[parseInt(level2Col)]?.trim() || "";
                if (level2Value) {
                  item.level2 = level2Value;
                }
              }
              item.requirement = requirementValue;
              if (typeCol && typeCol !== "skip") {
                const typeValue = row[parseInt(typeCol)]?.trim() || "";
                // Validate type value
                const validTypes = ["Information", "Mandatory", "Important", "Wish"];
                if (validTypes.includes(typeValue)) {
                  item.type = typeValue;
                }
              }
              isValid = true;
            }
          }
        }

        if (isValid) {
          dataToImport.push(item);
        } else {
          skippedCount++;
        }
      }

      setSkippedRowsCount(skippedCount);

      if (dataToImport.length === 0) {
        throw new Error("No valid data found to import");
      }

      // Call appropriate import API
      let count = 0;
      if (dataType === "tasks") {
        const result = await api.projects.importTasks(projectId, selectedPhaseId, dataToImport);
        count = result.count;
      } else if (dataType === "rfi-questions") {
        const result = await api.projects.importRFIQuestions(projectId, dataToImport);
        count = result.count;
      } else if (dataType === "requirements") {
        const result = await api.projects.importRequirements(projectId, dataToImport);
        count = result.count;
      }

      setImportCount(count);
      setStep("success");
      onSuccess?.(count, dataType);
    } catch (err: any) {
      setError(err.message || "Failed to import data");
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  const getPreviewRows = () => {
    if (!csvData) return [];
    const rows = skipFirstLine ? csvData.rows : [csvData.headers, ...csvData.rows];
    return rows.slice(0, 5);
  };

  const getNavigationUrl = () => {
    if (!dataType) return `/projects/${projectId}`;
    if (dataType === "tasks") return `/projects/${projectId}/tasks`;
    if (dataType === "rfi-questions") return `/projects/${projectId}/rfi`;
    if (dataType === "requirements") return `/projects/${projectId}/requirements`;
    return `/projects/${projectId}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Import {dataType ? DATA_TYPE_LABELS[dataType] : "data"} from a CSV file
            </DialogDescription>
          </DialogHeader>

          {file && (
            <div className="mt-2 p-3 bg-background-secondary rounded-md border border-border-primary">
              <div className="flex items-center space-x-2">
                <svg
                  className="h-5 w-5 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setCsvData(null);
                    setColumnMapping({});
                    setStep("select-file");
                  }}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === "select-type" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">
                  Select data type to import:
                </label>
                <div className="space-y-2">
                  {(["tasks", "rfi-questions", "requirements"] as ImportDataType[]).map((type) => (
                    <label
                      key={type}
                      className="flex items-center space-x-3 p-3 border border-border-primary rounded-md cursor-pointer hover:bg-background-secondary"
                    >
                      <input
                        type="radio"
                        name="dataType"
                        value={type}
                        checked={dataType === type}
                        onChange={() => {
                          setDataType(type);
                          setError("");
                        }}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-text-primary">{DATA_TYPE_LABELS[type]}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHelpDataType(type);
                        }}
                        className="text-sm text-accent-600 hover:text-accent-700"
                      >
                        Help
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "select-file" && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="csv-file-input"
                  className="block text-sm font-medium text-text-primary mb-2"
                >
                  Select CSV file:
                </label>
                <div
                  className="relative border-2 border-dashed border-border-primary rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const droppedFile = e.dataTransfer.files[0];
                    if (droppedFile) {
                      handleFileSelect({ target: { files: [droppedFile] } } as any);
                    }
                  }}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    aria-label="Select CSV file"
                    className="sr-only"
                    id="csv-file-input"
                  />
                  <div className="space-y-2">
                    <svg
                      className="mx-auto h-12 w-12 text-text-tertiary"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-sm text-text-primary">
                      <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      CSV or TXT files only
                    </p>
                  </div>
                </div>
              </div>
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2 text-sm text-text-secondary">Parsing CSV...</span>
                </div>
              )}
            </div>
          )}

          {step === "select-phase" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Select phase for tasks:
                </label>
                <select
                  value={selectedPhaseId}
                  onChange={(e) => {
                    setSelectedPhaseId(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a phase...</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.order}. {phase.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === "map-columns" && csvData && dataType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-primary">
                  Map CSV columns to data fields:
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipFirstLine}
                    onChange={(e) => setSkipFirstLine(e.target.checked)}
                    className="rounded border-border-primary text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-text-secondary">Skip first line (header row)</span>
                </label>
              </div>

              <div className="space-y-3">
                {Object.entries(FIELD_LABELS[dataType]).map(([field, label]) => {
                  const isRequired = dataType ? REQUIRED_FIELDS[dataType].includes(field) : false;
                  return (
                    <div key={field} className="flex items-center space-x-3">
                      <label className="w-48 text-sm font-medium text-text-primary">
                        {label} {isRequired && <span className="text-red-600">*</span>}
                      </label>
                      <select
                        value={columnMapping[field] || ""}
                        onChange={(e) => {
                          setColumnMapping({ ...columnMapping, [field]: e.target.value });
                          setError("");
                        }}
                        className="flex-1 px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select column...</option>
                        <option value="skip">Skip this field</option>
                        {csvData.headers.map((header, idx) => (
                          <option key={idx} value={idx.toString()}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-text-primary mb-2">Preview (first 5 rows):</h4>
                <div className="bg-background-secondary rounded-md p-4 overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="border-b border-border-primary">
                        {csvData.headers.map((header, idx) => (
                          <th key={idx} className="px-3 py-2 text-left font-semibold text-text-primary">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getPreviewRows().map((row, rowIdx) => (
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
            </div>
          )}

          {step === "review" && csvData && dataType && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Review your import settings. Click "Import" to proceed.
              </p>
              <div className="bg-background-secondary rounded-md p-4 space-y-2">
                <div><strong>Data Type:</strong> {DATA_TYPE_LABELS[dataType]}</div>
                <div><strong>File:</strong> {file?.name}</div>
                {dataType === "tasks" && (
                  <div><strong>Phase:</strong> {phases.find(p => p.id === selectedPhaseId)?.name}</div>
                )}
                <div><strong>Skip first line:</strong> {skipFirstLine ? "Yes" : "No"}</div>
                <div><strong>Total rows in file:</strong> {skipFirstLine ? csvData.rows.length : csvData.rows.length + 1}</div>
                {skippedRowsCount > 0 && (
                  <div className="text-amber-600 dark:text-amber-400">
                    <strong>Rows skipped because of bad/missing data:</strong> {skippedRowsCount}
                  </div>
                )}
                <div><strong>Rows to import:</strong> {
                  (() => {
                    const totalRows = skipFirstLine ? csvData.rows.length : csvData.rows.length + 1;
                    return totalRows - skippedRowsCount;
                  })()
                }</div>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-text-secondary">Importing data...</p>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Successfully imported {importCount} {importCount === 1 ? "item" : "items"}!
                </p>
              </div>
              <p className="text-sm text-text-secondary">
                Your data has been imported. You can view it on the relevant page.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <DialogFooter>
            {step !== "importing" && step !== "success" && (
              <>
                {step !== "select-type" && (
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleNext}
                  disabled={loading}
                >
                  {step === "review" ? "Import" : "Next"}
                </Button>
              </>
            )}
            {step === "success" && (
              <div className="flex gap-2 w-full justify-end">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    router.push(getNavigationUrl());
                    onOpenChange(false);
                  }}
                >
                  View {dataType ? DATA_TYPE_LABELS[dataType] : "Data"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {helpDataType && (
        <ImportHelpDialog
          dataType={helpDataType}
          open={!!helpDataType}
          onOpenChange={(open) => {
            if (!open) {
              setHelpDataType(null);
            }
          }}
        />
      )}
    </>
  );
};

