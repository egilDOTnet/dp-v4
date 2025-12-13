"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { RFIQuestionRenderer } from "@/components/vendor/RFIQuestionRenderer";
import { RFIProgressIndicator } from "@/components/vendor/RFIProgressIndicator";
import { VendorContactForm } from "@/components/vendor/VendorContactForm";

type Question = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  scaleLabels: Record<string, string> | null;
  options?: Array<{
    id: string;
    label: string;
    value: string | null;
    xAxis: boolean;
    yAxis: boolean;
    order: number;
  }>;
};

type RFIData = {
  project: {
    id: string;
    name: string;
    logoData: string | null;
    logoFileType: string | null;
    bannerData: string | null;
    bannerFileType: string | null;
  };
  rfi: {
    id: string;
    rfiInformation: string | null;
    questions: Question[];
  };
  vendor: {
    name: string;
  };
  vendorResponse: {
    status: string;
    answeredAt: string | null;
  };
  contactPerson: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  existingResponses: Record<string, any>;
  deadlinePassed?: boolean;
};

type PageType = "info" | "questions" | "contact" | "thank-you";

export default function VendorRFIPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Catch-all route: token array contains [jwt-token, ...path-segments]
  // JWT tokens contain dots but no slashes, so they stay as one element
  // Path segments like "questions", "contact" will be in subsequent elements
  const tokenArray = Array.isArray(params.token) ? params.token : [params.token as string];
  
  // Extract JWT token (first element) - this is the full JWT token
  const token = tokenArray[0] || "";
  
  // Determine page type from pathname or token array
  const getPageType = (): PageType => {
    if (!pathname && tokenArray.length === 1) return "info";
    // Check pathname first (more reliable)
    if (pathname?.includes("/thank-you")) return "thank-you";
    if (pathname?.includes("/contact")) return "contact";
    if (pathname?.includes("/questions")) return "questions";
    // Fallback: check token array for path segments
    if (tokenArray.length > 1) {
      const lastSegment = tokenArray[tokenArray.length - 1];
      if (lastSegment === "thank-you") return "thank-you";
      if (lastSegment === "contact") return "contact";
      if (lastSegment === "questions") return "questions";
    }
    return "info";
  };

  const pageType = getPageType();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);
  const [data, setData] = useState<RFIData | null>(null);
  
  // Questions page state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Contact page state
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null>(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      setLoading(false);
      return;
    }

    api.vendor.rfi
      .getByToken(token)
      .then((response) => {
        setData(response);
        
        // Initialize questions page data
        if (pageType === "questions" || pageType === "contact") {
          const filteredQuestions = response.rfi.questions.filter(
            (q: Question) => q.type !== "ContactDetails"
          );
          setQuestions(filteredQuestions);
          
          if (response.existingResponses) {
            setAnswers(response.existingResponses);
          }
          
          // Load from localStorage
          const saved = localStorage.getItem(`rfi-answers-${token}`);
          if (saved) {
            try {
              const savedAnswers = JSON.parse(saved);
              setAnswers((prev) => ({ ...prev, ...savedAnswers }));
            } catch (e) {
              console.error("Failed to load saved answers:", e);
            }
          }
        }
        
        // Initialize contact page data
        if (pageType === "contact") {
          setContact(
            response.contactPerson || {
              firstName: "",
              lastName: "",
              email: "",
              phone: null,
            }
          );
        }
        
        // Initialize thank-you page data
        if (pageType === "thank-you") {
          setProjectName(response.project.name);
        }
        
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Error loading RFI:", err);
        if (err.message?.includes("closed")) {
          setClosed(true);
        } else {
          setError(err.message || "Failed to load RFI");
        }
        setLoading(false);
      });
  }, [token, pageType]);

  // Save answers to localStorage
  useEffect(() => {
    if (pageType === "questions" && Object.keys(answers).length > 0) {
      localStorage.setItem(`rfi-answers-${token}`, JSON.stringify(answers));
    }
  }, [answers, token, pageType]);

  // Questions page handlers
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const validateCurrentQuestion = () => {
    if (!currentQuestion) return true;

    if (currentQuestion.required) {
      const answer = answers[currentQuestion.id];
      if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
        setErrors((prev) => ({
          ...prev,
          [currentQuestion.id]: "This question is required",
        }));
        return false;
      }
    }

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[currentQuestion.id];
      return newErrors;
    });

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentQuestion()) {
      return;
    }

    if (isLastQuestion) {
      router.push(`/rfi/${token}/contact`);
    } else {
      setCurrentIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push(`/rfi/${token}`);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Contact page handlers
  const handleSubmit = async () => {
    if (!contact || !contact.email || !contact.firstName || !contact.lastName) {
      setError("Please complete all required contact fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.vendor.rfi.submitResponse(token, {
        answers,
        contactPerson: contact,
      });

      localStorage.removeItem(`rfi-answers-${token}`);
      router.push(`/rfi/${token}/thank-you`);
    } catch (err: any) {
      setError(err.message || "Failed to submit response");
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading RFI...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !closed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <p className="text-text-secondary">
            Please check your link or contact the project administrator.
          </p>
        </div>
      </div>
    );
  }

  // Closed state
  if (closed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-2xl">
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            RFI Closed
          </h1>
          <p className="text-text-secondary text-lg">
            This Request for Information is now closed for replies. Thank you for your interest.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Thank You Page
  if (pageType === "thank-you") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-2xl">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Thank You!
          </h1>
          <p className="text-lg text-text-secondary mb-6">
            Your response to the Request for Information for{" "}
            <strong>{projectName || data.project.name}</strong> has been successfully submitted.
          </p>
          <p className="text-text-secondary">
            You will be notified as soon as possible with follow-up information about the process.
          </p>
        </div>
      </div>
    );
  }

  // Contact Page
  if (pageType === "contact") {
    if (!contact) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-text-secondary">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-6">
          Confirm Contact Details
        </h2>
        <p className="text-text-secondary mb-6">
          Please confirm or update the contact information for the main contact person for this RFI response.
        </p>

        <div className="bg-background-secondary rounded-lg p-6 mb-6">
          <VendorContactForm
            token={token}
            initialContact={data.contactPerson}
            vendorName={data.vendor.name}
            onContactChange={(newContact) => setContact(newContact)}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <Button
            variant="secondary"
            onClick={() => router.push(`/rfi/${token}/questions`)}
          >
            Back to Questions
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            Submit RFI
          </Button>
        </div>
      </div>
    );
  }

  // Questions Page
  if (pageType === "questions") {
    if (questions.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-text-secondary">No questions available.</p>
            <Button
              variant="secondary"
              onClick={() => router.push(`/rfi/${token}`)}
              className="mt-4"
            >
              Back to RFI Information
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <RFIProgressIndicator
            current={currentIndex + 1}
            total={questions.length}
          />
        </div>

        <div className="bg-background-secondary rounded-lg p-6 mb-6">
          <RFIQuestionRenderer
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            error={errors[currentQuestion.id]}
          />
        </div>

        <div className="flex justify-between">
          <Button variant="secondary" onClick={handleBack}>
            {currentIndex === 0 ? "Back" : "Previous"}
          </Button>
          <Button variant="primary" onClick={handleNext}>
            {isLastQuestion ? "Continue to Contact Details" : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  // Info Page (default)
  const hasAnswered = data.vendorResponse.status === "Answered" && data.vendorResponse.answeredAt;
  const deadlinePassed = data.deadlinePassed || false;

  // If deadline has passed, show limited view
  if (deadlinePassed) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Project Logo */}
        {data.project.logoData && (
          <div className="mb-8 flex justify-start">
            <img
              src={`data:${data.project.logoFileType || "image/png"};base64,${data.project.logoData}`}
              alt={`${data.project.name} logo`}
              className="max-h-24 max-w-full object-contain"
            />
          </div>
        )}

        {/* Project Banner */}
        {data.project.bannerData && (
          <div className="mb-8">
            <img
              src={`data:${data.project.bannerFileType || "image/png"};base64,${data.project.bannerData}`}
              alt={`${data.project.name} banner`}
              className="w-full h-auto max-h-64 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Project Name */}
        <h1 className="text-4xl font-bold text-text-primary mb-6 text-center">
          {data.project.name}
        </h1>

        {/* Deadline Message */}
        <div className="bg-background-secondary rounded-lg p-8 mb-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-text-secondary text-lg">
            The deadline for this Request for Information has passed.
          </p>
          <p className="text-text-secondary text-lg mt-4">
            We are no longer accepting new responses.
          </p>
          <p className="text-text-secondary text-lg mt-4">
            Thank you for your interest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Project Logo */}
      {data.project.logoData && (
        <div className="mb-8 flex justify-start">
          <img
            src={`data:${data.project.logoFileType || "image/png"};base64,${data.project.logoData}`}
            alt={`${data.project.name} logo`}
            className="max-h-24 max-w-full object-contain"
          />
        </div>
      )}

      {/* Project Banner */}
      {data.project.bannerData && (
        <div className="mb-8">
          <img
            src={`data:${data.project.bannerFileType || "image/png"};base64,${data.project.bannerData}`}
            alt={`${data.project.name} banner`}
            className="w-full h-auto max-h-64 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Project Name */}
      <h1 className="text-4xl font-bold text-text-primary mb-6 text-center">
        {data.project.name}
      </h1>

      {/* RFI Information */}
      {data.rfi.rfiInformation && (
        <div className="bg-background-secondary rounded-lg p-6 mb-8">
          <div
            className="prose prose-sm max-w-none text-text-primary"
            dangerouslySetInnerHTML={{ __html: data.rfi.rfiInformation }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {hasAnswered ? (
          <Button
            variant="primary"
            onClick={() => router.push(`/rfi/${token}/questions`)}
          >
            Edit Your Answers
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => router.push(`/rfi/${token}/questions`)}
          >
            Start Questionnaire
          </Button>
        )}
      </div>
    </div>
  );
}
