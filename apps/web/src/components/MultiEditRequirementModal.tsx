"use client";

import { useState } from "react";
import { RequirementHierarchy } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/button";
import { FormField, Select } from "@/components/ui/FormField";

interface MultiEditRequirementModalProps {
  projectId: string;
  hierarchies: RequirementHierarchy[];
  selectedCount: number;
  onSave: (data: {
    type?: "Information" | "Mandatory" | "Important" | "Wish";
    status?: "Approved" | "ForReview" | "New" | null;
    hierarchyId?: string;
  }) => void;
  onClose: () => void;
}

export default function MultiEditRequirementModal({
  projectId: _projectId,
  hierarchies,
  selectedCount,
  onSave,
  onClose,
}: MultiEditRequirementModalProps) {
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [hierarchyId, setHierarchyId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: {
        type?: "Information" | "Mandatory" | "Important" | "Wish";
        status?: "Approved" | "ForReview" | "New" | null;
        hierarchyId?: string;
      } = {};

      if (type !== "") {
        updateData.type = type as "Information" | "Mandatory" | "Important" | "Wish";
      }
      if (status !== "") {
        updateData.status = status === "null" ? null : (status as "Approved" | "ForReview" | "New");
      }
      if (hierarchyId !== "") {
        updateData.hierarchyId = hierarchyId;
      }

      await onSave(updateData);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setType("");
    setStatus("");
    setHierarchyId("");
    onClose();
  };

  // Flatten hierarchies for dropdown (show hierarchy path)
  const getHierarchyOptions = () => {
    const level1Hierarchies = hierarchies.filter((h) => h.parentId === null);
    const level2Hierarchies = hierarchies.filter((h) => h.parentId !== null);

    const options: Array<{ value: string; label: string }> = [];

    level1Hierarchies.forEach((h1) => {
      options.push({
        value: h1.id,
        label: `${h1.number} ${h1.title}`,
      });

      level2Hierarchies
        .filter((h2) => h2.parentId === h1.id)
        .forEach((h2) => {
          options.push({
            value: h2.id,
            label: `  ${h2.number} ${h2.title}`,
          });
        });
    });

    return options;
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Multi-Edit Requirements</DialogTitle>
          <DialogDescription>
            Editing {selectedCount} requirement{selectedCount !== 1 ? "s" : ""}. Leave fields as "Don't change" to keep existing values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">

          <FormField label="Type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Don't change</option>
              <option value="Information">Information</option>
              <option value="Mandatory">Mandatory</option>
              <option value="Important">Important</option>
              <option value="Wish">Wish</option>
            </Select>
          </FormField>

          <FormField label="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Don't change</option>
              <option value="New">New</option>
              <option value="ForReview">For Review</option>
              <option value="Approved">Approved</option>
            </Select>
          </FormField>

          <FormField label="Move to Hierarchy">
            <Select
              value={hierarchyId}
              onChange={(e) => setHierarchyId(e.target.value)}
            >
              <option value="">Don't change</option>
              {getHierarchyOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={saving}
            className="bg-accent-600 hover:bg-accent-700 text-white"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
