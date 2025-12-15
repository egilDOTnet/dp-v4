"use client";

import { useState } from "react";
import { RFIQuestion, RFIQuestionType } from "@/lib/api";
import QuestionOptionManager from "./QuestionOptionManager";
import ScaleConfigurator from "./ScaleConfigurator";

interface QuestionFormProps {
  question?: RFIQuestion;
  projectId: string;
  onSubmit: (data: {
    title: string;
    description?: string | null;
    type: RFIQuestionType;
    required?: boolean;
    scaleLabels?: Record<string, string> | null;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export default function QuestionForm({
  question,
  projectId,
  onSubmit,
  onCancel,
  onDelete,
}: QuestionFormProps) {
  const [title, setTitle] = useState(question?.title || "");
  const [description, setDescription] = useState(question?.description || "");
  const [type, setType] = useState<RFIQuestionType>(
    question?.type || "SingleText"
  );
  const [required, setRequired] = useState(question?.required ?? true);
  const [scaleLabels, setScaleLabels] = useState<Record<string, string>>(
    question?.scaleLabels || {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        type,
        required,
        scaleLabels: type === "Scale" ? scaleLabels : null,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save question");
      setSubmitting(false);
    }
  };

  const needsOptions = type === "Dropdown" || type === "MultipleChoice";
  const needsScaleConfig = type === "Scale";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
          Type *
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as RFIQuestionType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="YesNo">Yes/No</option>
          <option value="Dropdown">Dropdown</option>
          <option value="MultipleChoice">Multiple Choice</option>
          <option value="Scale">Scale</option>
          <option value="SingleText">Single Text</option>
          <option value="MultilineText">Multiline Text</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          id="required"
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="required" className="ml-2 block text-sm text-gray-700">
          Required
        </label>
      </div>

      {needsOptions && question && (
        <QuestionOptionManager
          questionId={question.id}
          questionType={type}
          projectId={projectId}
        />
      )}

      {needsScaleConfig && (
        <ScaleConfigurator
          scaleLabels={scaleLabels}
          onChange={setScaleLabels}
        />
      )}

      {type === "ContactDetails" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Contact Details questions will display vendor information and allow
            editing of contact person fields (first name, last name, email,
            phone).
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : question ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        {question && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ml-auto"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
