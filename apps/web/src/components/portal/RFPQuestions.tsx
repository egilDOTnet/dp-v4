"use client";

import { useState } from "react";
import { RFPDetail } from "@/lib/api";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/FormField";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { Textarea } from "@/components/ui/FormField";
import { formatISODateTime } from "@/lib/utils";

interface RFPQuestionsProps {
  rfpId: string;
  rfp: RFPDetail;
  onReload: () => void;
  showQuestionModal?: boolean;
  onCloseQuestionModal?: () => void;
}

export function RFPQuestions({ rfpId, rfp, onReload, showQuestionModal: externalShowQuestionModal, onCloseQuestionModal }: RFPQuestionsProps) {
  const [internalShowQuestionModal, setInternalShowQuestionModal] = useState(false);
  const showQuestionModal = externalShowQuestionModal !== undefined ? externalShowQuestionModal : internalShowQuestionModal;
  
  const closeModal = () => {
    if (onCloseQuestionModal) {
      onCloseQuestionModal();
    } else {
      setInternalShowQuestionModal(false);
    }
  };
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmitQuestion = async () => {
    if (!question.trim()) {
      setError("Question is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.vendorRfp.rfps.askQuestion(rfpId, question.trim());
      setQuestion("");
      closeModal();
      onReload(); // Reload to show new question
    } catch (err: any) {
      setError(err.message || "Failed to submit question");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div>
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold text-text-primary">Questions and Answers</h2>
        </CardHeader>
        <CardBody>
          {rfp.questions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/5">Date</TableHead>
                  <TableHead className="w-2/5">Question</TableHead>
                  <TableHead className="w-2/5">Answer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfp.questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-text-secondary align-top">
                      {q.answeredAt ? formatISODateTime(q.answeredAt) : formatISODateTime(q.createdAt)}
                    </TableCell>
                    <TableCell className="text-text-primary align-top">
                      <div className="font-medium">
                        {q.cleanedQuestion || q.question}
                      </div>
                    </TableCell>
                    <TableCell className="text-text-primary align-top">
                      {q.answer ? (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: q.answer }}
                        />
                      ) : (
                        <span className="text-text-tertiary italic">Not answered yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-text-secondary">No questions yet.</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Ask Question Modal */}
      {showQuestionModal && (
        <Dialog open={true} onClose={closeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ask a Question</DialogTitle>
              <DialogDescription>
                Submit your question about this RFP. The project team will review and respond.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-text-primary mb-1">
                  Question
                </label>
                <Textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={5}
                  placeholder="Enter your question..."
                  className="w-full"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSubmitQuestion} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


