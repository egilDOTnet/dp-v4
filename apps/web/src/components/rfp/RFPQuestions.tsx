"use client";

import { useEffect, useState } from "react";
import { api, RFP, RFPQuestion, ProjectVendor } from "@/lib/api";
import { Button, Card, CardHeader, CardBody, SearchBar, EmptyState } from "@/components/ui";
import { useSearch } from "@/hooks/useSearch";
import { formatISODateTime } from "@/lib/utils";
import SplitQuestionModal from "./SplitQuestionModal";
import AnswerQuestionModal from "./AnswerQuestionModal";
import CreateQuestionModal from "./CreateQuestionModal";

interface RFPQuestionsProps {
  projectId: string;
  rfp: RFP;
}

export default function RFPQuestions({ projectId, rfp: _rfp }: RFPQuestionsProps) {
  const [questions, setQuestions] = useState<RFPQuestion[]>([]);
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"answered" | "unanswered">("unanswered");
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<RFPQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { searchTerm, setSearchTerm, filteredItems } = useSearch(questions, {
    searchKeys: ["question", "cleanedQuestion", "vendor.name", "contactPerson.firstName", "contactPerson.lastName"],
  });

  useEffect(() => {
    loadData();
  }, [projectId, filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [questionsData, vendorsData] = await Promise.all([
        api.rfp.questions.list(projectId, filter),
        api.projects.vendors.list(projectId),
      ]);
      setQuestions(questionsData);
      setVendors(vendorsData);
    } catch (err: any) {
      console.error("Error loading questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = (question: RFPQuestion) => {
    setSelectedQuestion(question);
    setSplitModalOpen(true);
  };

  const handleAnswer = (question: RFPQuestion) => {
    setSelectedQuestion(question);
    setAnswerModalOpen(true);
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      setDeletingId(questionId);
      await api.rfp.questions.delete(projectId, questionId);
      await loadData();
    } catch (err: any) {
      console.error("Error deleting question:", err);
    } finally {
      setDeletingId(null);
    }
  };


  const getUserName = (question: RFPQuestion) => {
    if (question.answeredBy) {
      if (question.answeredBy.firstName || question.answeredBy.lastName) {
        return `${question.answeredBy.firstName || ""} ${question.answeredBy.lastName || ""}`.trim();
      }
      return question.answeredBy.name || question.answeredBy.email || "Unknown";
    }
    return "Unknown";
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search questions..." />
        </div>
        <Button onClick={() => setCreateModalOpen(true)} variant="primary">
          Add Question
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Questions & Answers</h2>
            <div className="flex items-center gap-2 bg-background-tertiary rounded-md p-1 border border-border-primary">
              <button
                onClick={() => setFilter("unanswered")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filter === "unanswered"
                    ? "bg-primary-600 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Unanswered
              </button>
              <button
                onClick={() => setFilter("answered")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filter === "answered"
                    ? "bg-primary-600 text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Answered
              </button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {filteredItems.length === 0 ? (
            <EmptyState
              title={searchTerm ? "No questions match your search" : filter === "unanswered" ? "No unanswered questions" : "No answered questions"}
              description={
                searchTerm
                  ? `Try adjusting your search terms to find what you're looking for.`
                  : filter === "unanswered"
                  ? "All questions have been answered. Vendors can submit new questions at any time."
                  : "No questions have been answered yet. Answer questions to help vendors better understand your requirements."
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredItems.map((question) => (
                <Card key={question.id}>
                  <CardBody>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-text-secondary mb-1">
                          {formatISODateTime(question.createdAt)} • {question.vendor?.name || "Unknown Vendor"} •{" "}
                          {question.contactPerson
                            ? `${question.contactPerson.firstName} ${question.contactPerson.lastName}`.trim()
                            : "Unknown Contact"}
                        </div>
                        <div className="text-text-primary font-medium mt-2">
                          {question.cleanedQuestion || question.question}
                        </div>
                        {question.answer && (
                          <div className="mt-4 p-4 bg-background-tertiary rounded-md">
                            <div className="text-sm font-semibold text-text-primary mb-2">Answer:</div>
                            <div
                              className="text-text-primary prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: question.answer }}
                            />
                            <div className="text-xs text-text-secondary mt-2">
                              Answered {question.answeredAt ? formatISODateTime(question.answeredAt) : ""} by {getUserName(question)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSplit(question)} variant="secondary" size="sm">
                          Split
                        </Button>
                        {!question.answer && (
                          <Button onClick={() => handleAnswer(question)} variant="primary" size="sm">
                            Answer
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(question.id)}
                          disabled={deletingId === question.id}
                          variant="danger"
                          size="sm"
                        >
                          {deletingId === question.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

    {splitModalOpen && selectedQuestion && (
      <SplitQuestionModal
        projectId={projectId}
        question={selectedQuestion}
        onClose={() => {
          setSplitModalOpen(false);
          setSelectedQuestion(null);
          loadData();
        }}
      />
    )}

    {answerModalOpen && selectedQuestion && (
      <AnswerQuestionModal
        projectId={projectId}
        question={selectedQuestion}
        onClose={() => {
          setAnswerModalOpen(false);
          setSelectedQuestion(null);
          loadData();
        }}
      />
    )}

    {createModalOpen && (
      <CreateQuestionModal
        projectId={projectId}
        vendors={vendors}
        onClose={() => {
          setCreateModalOpen(false);
          loadData();
        }}
      />
    )}
    </div>
  );
}

