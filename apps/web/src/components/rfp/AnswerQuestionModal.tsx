"use client";

import { useState } from "react";
import { api, RFPQuestion } from "@/lib/api";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import WysiwygEditor from "@/components/WysiwygEditor";

interface AnswerQuestionModalProps {
  projectId: string;
  question: RFPQuestion;
  onClose: () => void;
}

export default function AnswerQuestionModal({
  projectId,
  question,
  onClose,
}: AnswerQuestionModalProps) {
  const [cleanedQuestion, setCleanedQuestion] = useState(question.cleanedQuestion || question.question);
  const [answer, setAnswer] = useState(question.answer || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      if (!answer.trim()) {
        setError("Answer is required");
        return;
      }

      await api.rfp.questions.answer(projectId, question.id, {
        cleanedQuestion,
        answer,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save answer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Answer Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Cleaned Up Question
            </label>
            <textarea
              value={cleanedQuestion}
              onChange={(e) => setCleanedQuestion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Answer *
            </label>
            <WysiwygEditor value={answer} onChange={setAnswer} placeholder="Enter answer..." />
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
            <Button onClick={handleSave} disabled={saving} variant="primary" size="sm">
              {saving ? "Saving..." : "Save Answer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

