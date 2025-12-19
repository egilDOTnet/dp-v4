"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { RFIQuestionRenderer } from "@/components/vendor/RFIQuestionRenderer";
import { RFIProgressIndicator } from "@/components/vendor/RFIProgressIndicator";
import { RFIHeader } from "@/components/vendor/RFIHeader";

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

export default function VendorRFIQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [projectData, setProjectData] = useState<{
    name: string;
    logoData: string | null;
    logoFileType: string | null;
    bannerData: string | null;
    bannerFileType: string | null;
  } | null>(null);

  useEffect(() => {
    if (!token) return;

    // Load RFI data
    api.vendor.rfi
      .getByToken(token)
      .then((data) => {
        // Store project data for logo/banner
        setProjectData({
          name: data.project.name,
          logoData: data.project.logoData,
          logoFileType: data.project.logoFileType,
          bannerData: data.project.bannerData,
          bannerFileType: data.project.bannerFileType,
        });

        // Filter out ContactDetails questions (handled on contact page)
        const filteredQuestions = data.rfi.questions.filter(
          (q: Question) => q.type !== "ContactDetails"
        );
        setQuestions(filteredQuestions);

        // Load existing answers if any
        if (data.existingResponses) {
          setAnswers(data.existingResponses);
        }

        // Load from localStorage if available
        const saved = localStorage.getItem(`rfi-answers-${token}`);
        if (saved) {
          try {
            const savedAnswers = JSON.parse(saved);
            setAnswers((prev) => ({ ...prev, ...savedAnswers }));
          } catch (e) {
            console.error("Failed to load saved answers:", e);
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load RFI:", err);
        setLoading(false);
      });
  }, [token]);

  // Save answers to localStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`rfi-answers-${token}`, JSON.stringify(answers));
    }
  }, [answers, token]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const validateCurrentQuestion = () => {
    if (!currentQuestion) return true;

    if (currentQuestion.required) {
      const answer = answers[currentQuestion.id];
      // Check for empty values
      if (
        answer === undefined ||
        answer === null ||
        answer === "" ||
        (Array.isArray(answer) && answer.length === 0) ||
        (typeof answer === "object" && !Array.isArray(answer) && Object.keys(answer).length === 0)
      ) {
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
      // Navigate to contact page
      router.push(`/rfi/${token}/contact`);
    } else {
      setCurrentIndex((prev) => prev + 1);
      // Scroll to top
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

  const handleAnswerChange = async (questionId: string, value: any) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    // Save answers to backend to set status to "Started"
    // Use a debounced approach to avoid too many API calls
    try {
      await api.vendor.rfi.saveAnswers(token, newAnswers);
      console.log("Answers saved successfully, status should be 'Started'");
    } catch (err: any) {
      console.error("Failed to save answers:", err);
      console.error("Error details:", err.message, err.response);
      // Don't show error to user, just log it - answers are saved in localStorage anyway
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading questions...</p>
        </div>
      </div>
    );
  }

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
      {projectData && (
        <RFIHeader
          projectName={projectData.name}
          logoData={projectData.logoData}
          logoFileType={projectData.logoFileType}
          bannerData={projectData.bannerData}
          bannerFileType={projectData.bannerFileType}
        />
      )}

      {/* Progress Indicator */}
      <div className="mb-8">
        <RFIProgressIndicator
          current={currentIndex + 1}
          total={questions.length}
        />
      </div>

      {/* Question */}
      <div className="bg-background-secondary rounded-lg p-6 mb-6">
        <RFIQuestionRenderer
          question={currentQuestion}
          value={answers[currentQuestion.id]}
          onChange={(value) => handleAnswerChange(currentQuestion.id, value)}
          error={errors[currentQuestion.id]}
        />
      </div>

      {/* Navigation */}
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


