"use client";

import { useState } from "react";
import { api, RFPQuestion } from "@/lib/api";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";

interface SplitQuestionModalProps {
  projectId: string;
  question: RFPQuestion;
  onClose: () => void;
}

export default function SplitQuestionModal({
  projectId,
  question,
  onClose,
}: SplitQuestionModalProps) {
  const [splitText, setSplitText] = useState(question.question);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSplit = async () => {
    try {
      setSaving(true);
      setError("");

      // Split on lines containing only "---"
      const parts = splitText
        .split(/\n/)
        .reduce((acc: string[], line) => {
          if (line.trim() === "---") {
            acc.push("");
          } else {
            if (acc.length === 0) acc.push("");
            acc[acc.length - 1] += (acc[acc.length - 1] ? "\n" : "") + line;
          }
          return acc;
        }, [])
        .filter((part) => part.trim());

      if (parts.length < 2) {
        setError("Please split into at least 2 questions using '---' on separate lines");
        return;
      }

      await api.rfp.questions.split(projectId, question.id, {
        questions: parts,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to split question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">
              Enter the question text below. Use <code className="bg-background-tertiary px-1 py-0.5 rounded">---</code> on a separate line to indicate where to split the question into multiple questions.
            </p>
            <textarea
              value={splitText}
              onChange={(e) => setSplitText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary font-mono text-sm"
              placeholder="Question 1 text&#10;---&#10;Question 2 text&#10;---&#10;Question 3 text"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button onClick={onClose} variant="secondary" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSplit} disabled={saving} variant="primary" size="sm">
              {saving ? "Splitting..." : "Split Question"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

