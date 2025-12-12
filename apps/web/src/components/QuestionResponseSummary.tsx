"use client";

import { useState, useEffect } from "react";
import { api, RFIVendorResponse, RFIQuestion, RFIQuestionType } from "@/lib/api";

interface QuestionResponseSummaryProps {
  projectId: string;
}

interface QuestionSummary {
  question: RFIQuestion;
  totalResponses: number;
  answeredCount: number;
  answers: any[];
}

export default function QuestionResponseSummary({ projectId }: QuestionResponseSummaryProps) {
  const [summaries, setSummaries] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSummary();
  }, [projectId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Load RFI and questions
      const rfi = await api.rfi.get(projectId);
      if (!rfi.questions || rfi.questions.length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      // Load all vendor responses
      const vendorResponses = await api.rfi.vendorResponses.list(projectId);
      const answeredResponses = vendorResponses.filter(r => r.status === "Answered");

      // For each question, get all answers
      const questionSummaries: QuestionSummary[] = await Promise.all(
        rfi.questions.map(async (question) => {
          const answers: any[] = [];
          
          // Get answers for this question from all answered responses
          for (const vendorResponse of answeredResponses) {
            try {
              const fullResponse = await api.rfi.vendorResponses.get(projectId, vendorResponse.id);
              const answer = fullResponse.responses.find(r => r.questionId === question.id);
              if (answer) {
                answers.push({
                  vendorName: vendorResponse.vendorName,
                  answer: answer.answer,
                });
              }
            } catch (err) {
              console.error(`Error loading response for ${vendorResponse.vendorName}:`, err);
            }
          }

          return {
            question,
            totalResponses: vendorResponses.length,
            answeredCount: answers.length,
            answers,
          };
        })
      );

      setSummaries(questionSummaries);
    } catch (err: any) {
      console.error("Error loading question summary:", err);
      setError(err.message || "Failed to load question summary");
    } finally {
      setLoading(false);
    }
  };

  const formatAnswerSummary = (answers: any[], questionType: RFIQuestionType) => {
    if (answers.length === 0) {
      return <span className="text-gray-400 italic">No answers yet</span>;
    }

    switch (questionType) {
      case "YesNo":
        const yesCount = answers.filter(a => a.answer === true || a.answer === "true").length;
        const noCount = answers.length - yesCount;
        return (
          <div className="space-y-1">
            <div>Yes: {yesCount} ({Math.round((yesCount / answers.length) * 100)}%)</div>
            <div>No: {noCount} ({Math.round((noCount / answers.length) * 100)}%)</div>
          </div>
        );
      case "Scale":
        const scaleValues = answers.map(a => Number(a.answer)).filter(v => !isNaN(v));
        if (scaleValues.length > 0) {
          const avg = scaleValues.reduce((a, b) => a + b, 0) / scaleValues.length;
          const min = Math.min(...scaleValues);
          const max = Math.max(...scaleValues);
          return (
            <div className="space-y-1">
              <div>Average: {avg.toFixed(2)}</div>
              <div>Range: {min} - {max}</div>
            </div>
          );
        }
        return <span>{answers.length} answer(s)</span>;
      case "MultipleChoice":
      case "Dropdown":
        // Count occurrences of each answer
        const answerCounts: Record<string, number> = {};
        answers.forEach(a => {
          const key = Array.isArray(a.answer) ? a.answer.join(", ") : String(a.answer);
          answerCounts[key] = (answerCounts[key] || 0) + 1;
        });
        return (
          <div className="space-y-1">
            {Object.entries(answerCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([answer, count]) => (
                <div key={answer}>
                  {answer}: {count} ({Math.round((count / answers.length) * 100)}%)
                </div>
              ))}
          </div>
        );
      default:
        return (
          <div className="space-y-1">
            <div>{answers.length} answer(s) provided</div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                View all answers
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                {answers.map((a, idx) => (
                  <div key={idx} className="text-sm">
                    <strong>{a.vendorName}:</strong> {String(a.answer)}
                  </div>
                ))}
              </div>
            </details>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No questions found or no responses yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Response Summary by Question</h3>
      {summaries.map((summary) => (
        <div key={summary.question.id} className="border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <h4 className="text-base font-semibold text-gray-900">
              {summary.question.title}
            </h4>
            <div className="mt-2 text-sm text-gray-500">
              {summary.answeredCount} of {summary.totalResponses} vendors answered
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            {formatAnswerSummary(summary.answers, summary.question.type)}
          </div>
        </div>
      ))}
    </div>
  );
}

