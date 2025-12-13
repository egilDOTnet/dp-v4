"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, RFI, RFIQuestion, Project } from "@/lib/api";

export default function RFIPreviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [rfi, setRfi] = useState<RFI | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (projectId) {
      loadPreview();
    }
  }, [projectId]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const [rfiData, projectData] = await Promise.all([
        api.rfi.preview(projectId),
        api.projects.get(projectId),
      ]);
      setRfi(rfiData);
      setProject(projectData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question: RFIQuestion) => {
    switch (question.type) {
      case "YesNo":
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name={`q-${question.id}`} disabled />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name={`q-${question.id}`} disabled />
              <span>No</span>
            </label>
          </div>
        );

      case "Dropdown":
        return (
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled
          >
            <option>Select an option</option>
            {question.options?.map((option) => (
              <option key={option.id} value={option.value || option.label}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "MultipleChoice":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <label key={option.id} className="flex items-center gap-2">
                <input type="checkbox" disabled />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );

      case "Scale":
        return (
          <div className="space-y-2">
            <div className="flex gap-4">
              {question.scaleLabels &&
                Object.entries(question.scaleLabels).map(([point, label]) => (
                  <label key={point} className="flex items-center gap-2">
                    <input type="radio" name={`q-${question.id}`} disabled />
                    <span className="text-sm">
                      {point}: {label || point}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        );

      case "ContactDetails":
        return (
          <div className="space-y-4 p-4 bg-background-secondary border border-gray-200 rounded-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-background-tertiary"
                disabled
                placeholder="Vendor name (read-only)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="Last name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="Email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="Phone number"
              />
            </div>
          </div>
        );

      case "SingleText":
        return (
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled
            placeholder="Enter your answer"
          />
        );

      case "MultilineText":
        return (
          <textarea
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled
            placeholder="Enter your answer"
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div>
        <nav className="mb-4 text-sm text-gray-600">
          <Link href="/dashboard" className="hover:text-primary-600">
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <Link href="/projects" className="hover:text-primary-600">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
            Project
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${projectId}/rfi`} className="hover:text-primary-600">
            RFI
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Preview</span>
        </nav>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !rfi) {
    return (
      <div>
        <nav className="mb-4 text-sm text-gray-600">
          <Link href={`/projects/${projectId}/rfi`} className="hover:text-primary-600">
            Back to RFI
          </Link>
        </nav>
        <div className="text-center">
          <p className="text-red-600">{error || "RFI not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          Project
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}/rfi`} className="hover:text-primary-600">
          RFI
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Preview</span>
      </nav>

      <div className="bg-background-secondary rounded-lg shadow-md p-8">
        {/* Banner Image */}
        {project?.bannerData && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={`data:${project.bannerFileType || "image/png"};base64,${project.bannerData}`}
              alt="Project banner"
              className="w-full h-auto object-cover"
              style={{ maxHeight: "300px" }}
            />
          </div>
        )}

        {/* RFI Information */}
        {rfi.rfiInformation && (
          <div className="mb-8">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: rfi.rfiInformation }}
            />
          </div>
        )}

        {/* Questions */}
        <div className="space-y-8 mb-8">
          {rfi.questions && rfi.questions.length > 0 ? (
            rfi.questions.map((question, index) => (
              <div key={question.id} className="border-b pb-6 last:border-b-0">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">
                    {index + 1}. {question.title}
                    {question.required && (
                      <span className="ml-2 text-red-600">*</span>
                    )}
                  </h3>
                  {question.description && (
                    <p className="text-gray-600 mb-4">{question.description}</p>
                  )}
                </div>
                {renderQuestion(question)}
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic">No questions added yet.</p>
          )}
        </div>

        {/* Contact Details Section */}
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-semibold mb-4">Contact Details</h2>
          <div className="space-y-4 p-4 bg-background-secondary border border-gray-200 rounded-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-background-tertiary"
                disabled
                placeholder="[Vendor name will be shown here]"
              />
              <p className="mt-1 text-xs text-gray-500">
                This is read-only and will show the vendor's name
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Contact - First Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="[Contact first name will be shown here]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Contact - Last Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="[Contact last name will be shown here]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="[Contact email will be shown here]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled
                placeholder="[Contact phone will be shown here]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
