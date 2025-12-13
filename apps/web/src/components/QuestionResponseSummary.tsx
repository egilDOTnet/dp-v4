"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api, RFIQuestion } from "@/lib/api";

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

  // Add a refresh function that can be called manually
  const handleRefresh = () => {
    loadSummary();
  };

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
      console.log("[QuestionResponseSummary] All vendor responses:", JSON.stringify(vendorResponses, null, 2));
      
      // Filter for answered responses - check for both "Answered" status and non-null id
      // Use trim and case-insensitive comparison to be more robust
      const answeredResponses = vendorResponses.filter(
        r => {
          const statusMatch = r.status && String(r.status).trim() === "Answered";
          const hasId = r.id !== null;
          console.log(`[QuestionResponseSummary] Vendor ${r.vendorName}: status="${r.status}", id=${r.id}, matches=${statusMatch && hasId}`);
          return statusMatch && hasId;
        }
      );
      
      console.log("[QuestionResponseSummary] Filtered answered responses:", JSON.stringify(answeredResponses, null, 2));

      // For each question, get all answers
      const questionSummaries: QuestionSummary[] = await Promise.all(
        rfi.questions.map(async (question) => {
          const answers: any[] = [];
          let enrichedQuestion = question; // Use question from RFI, but enrich with options from answer if needed
          
          // Get answers for this question from all answered responses
          for (const vendorResponse of answeredResponses) {
            // Skip if id is null (shouldn't happen after filter, but defensive check)
            if (!vendorResponse.id) {
              console.warn(`Skipping vendor response with null id: ${vendorResponse.vendorName}`);
              continue;
            }

            try {
              const fullResponse = await api.rfi.vendorResponses.get(projectId, vendorResponse.id);
              console.log(`[QuestionResponseSummary] Full response for ${vendorResponse.vendorName}:`, JSON.stringify(fullResponse, null, 2));
              
              if (fullResponse.responses && Array.isArray(fullResponse.responses)) {
                console.log(`[QuestionResponseSummary] Question ${question.id} (${typeof question.id}), looking in ${fullResponse.responses.length} responses:`, 
                  fullResponse.responses.map(r => ({ questionId: r.questionId, type: typeof r.questionId, hasAnswer: r.answer !== null && r.answer !== undefined })));
                
                // Use string comparison to handle type mismatches
                const answer = fullResponse.responses.find(r => {
                  const match = String(r.questionId) === String(question.id);
                  console.log(`[QuestionResponseSummary] Comparing questionId: "${r.questionId}" (${typeof r.questionId}) === "${question.id}" (${typeof question.id}) = ${match}`);
                  return match;
                });
                
                if (answer) {
                  console.log(`[QuestionResponseSummary] Found answer object for question ${question.id} from ${vendorResponse.vendorName}:`, answer);
                  
                  // Enrich question with options from answer if question doesn't have options
                  if (answer.question && (!enrichedQuestion.options || enrichedQuestion.options.length === 0)) {
                    enrichedQuestion = { ...enrichedQuestion, options: answer.question.options || [] };
                  }
                  
                  if (answer.answer !== null && answer.answer !== undefined) {
                    console.log(`[QuestionResponseSummary] Answer value is valid:`, answer.answer);
                    answers.push({
                      vendorName: vendorResponse.vendorName,
                      answer: answer.answer,
                    });
                  } else {
                    console.warn(`[QuestionResponseSummary] Answer exists but value is null/undefined:`, answer.answer);
                  }
                } else {
                  console.log(`[QuestionResponseSummary] No matching questionId found for question ${question.id} from ${vendorResponse.vendorName}`);
                }
              } else {
                console.warn(`[QuestionResponseSummary] No responses array in fullResponse for ${vendorResponse.vendorName}. Full response:`, JSON.stringify(fullResponse, null, 2));
              }
            } catch (err) {
              console.error(`[QuestionResponseSummary] Error loading response for ${vendorResponse.vendorName}:`, err);
            }
          }

          return {
            question: enrichedQuestion,
            totalResponses: vendorResponses.length,
            answeredCount: answers.length,
            answers,
          };
        })
      );

      console.log("[QuestionResponseSummary] Final question summaries:", JSON.stringify(questionSummaries.map(s => ({
        questionId: s.question.id,
        questionTitle: s.question.title,
        totalResponses: s.totalResponses,
        answeredCount: s.answeredCount,
        answersCount: s.answers.length,
        answers: s.answers
      })), null, 2));
      setSummaries(questionSummaries);
    } catch (err: any) {
      console.error("Error loading question summary:", err);
      setError(err.message || "Failed to load question summary");
    } finally {
      setLoading(false);
    }
  };

  const formatAnswerSummary = (summary: QuestionSummary) => {
    const { answers, question } = summary;
    const questionType = question.type;

    if (answers.length === 0) {
      return <span className="text-gray-400 italic">No answers yet</span>;
    }

    switch (questionType) {
      case "YesNo": {
        const yesCount = answers.filter(a => a.answer === true || a.answer === "true" || a.answer === true).length;
        const noCount = answers.length - yesCount;
        const chartData = [
          { name: "Yes", count: yesCount, percentage: Math.round((yesCount / answers.length) * 100) },
          { name: "No", count: noCount, percentage: Math.round((noCount / answers.length) * 100) },
        ];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Yes: {yesCount} ({Math.round((yesCount / answers.length) * 100)}%)</div>
              <div>No: {noCount} ({Math.round((noCount / answers.length) * 100)}%)</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`${value} (${chartData.find(d => d.count === value)?.percentage}%)`, "Count"]} />
                <Bar dataKey="count" fill="#3b82f6">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === "Yes" ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case "Scale": {
        const scaleValues = answers.map(a => Number(a.answer)).filter(v => !isNaN(v));
        if (scaleValues.length > 0) {
          const avg = scaleValues.reduce((a, b) => a + b, 0) / scaleValues.length;
          const min = Math.min(...scaleValues);
          const max = Math.max(...scaleValues);
          
          // Create histogram data
          const bins: Record<number, number> = {};
          for (let i = min; i <= max; i++) {
            bins[i] = 0;
          }
          scaleValues.forEach(v => {
            bins[Math.round(v)] = (bins[Math.round(v)] || 0) + 1;
          });
          
          const chartData = Object.entries(bins).map(([value, count]) => ({
            value: question.scaleLabels?.[value] || value,
            count,
            percentage: Math.round((count / scaleValues.length) * 100),
          }));

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>Average: {avg.toFixed(2)}</div>
                <div>Min: {min}</div>
                <div>Max: {max}</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="value" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value} (${chartData.find(d => d.count === value)?.percentage}%)`, "Count"]} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        }
        return <span>{answers.length} answer(s)</span>;
      }
      case "MultipleChoice": {
        // Check if this is a grid-style multiple choice (has both xAxis and yAxis options)
        const xAxisOptions = question.options?.filter(opt => opt.xAxis).sort((a, b) => a.order - b.order) || [];
        const yAxisOptions = question.options?.filter(opt => opt.yAxis).sort((a, b) => a.order - b.order) || [];
        const regularOptions = question.options?.filter(opt => !opt.xAxis && !opt.yAxis).sort((a, b) => a.order - b.order) || [];

        if (xAxisOptions.length > 0 && yAxisOptions.length > 0) {
          // Grid-style: answer is an object { [yAxisOptionId]: xAxisOptionValue }
          // Count selections for each xAxis option
          const xAxisCounts: Record<string, number> = {};
          xAxisOptions.forEach(xOpt => {
            xAxisCounts[xOpt.id] = 0;
            xAxisCounts[xOpt.value || xOpt.label] = 0;
          });

          answers.forEach(a => {
            if (typeof a.answer === "object" && a.answer !== null && !Array.isArray(a.answer)) {
              Object.values(a.answer).forEach((selectedValue: any) => {
                const valueStr = String(selectedValue);
                if (xAxisCounts[valueStr] !== undefined) {
                  xAxisCounts[valueStr]++;
                } else {
                  // Try to find by matching option
                  const matchingOpt = xAxisOptions.find(opt => opt.id === valueStr || opt.value === valueStr || opt.label === valueStr);
                  if (matchingOpt) {
                    const key = matchingOpt.value || matchingOpt.label || matchingOpt.id;
                    xAxisCounts[key] = (xAxisCounts[key] || 0) + 1;
                  }
                }
              });
            }
          });

          const chartData = xAxisOptions.map(xOpt => {
            const key = xOpt.value || xOpt.label || xOpt.id;
            const count = xAxisCounts[xOpt.id] || xAxisCounts[key] || 0;
            return {
              option: xOpt.label,
              count,
              percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
            };
          }).filter(d => d.count > 0);

          return (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                {chartData.map((item) => (
                  <div key={item.option}>
                    {item.option}: {item.count} ({item.percentage}%)
                  </div>
                ))}
              </div>
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="option" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value} (${chartData.find(d => d.count === value)?.percentage}%)`, "Count"]} />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        } else {
          // Regular multiple choice: answer is an array of option values
          const optionCounts: Record<string, number> = {};
          regularOptions.forEach(opt => {
            const key = opt.value || opt.label || opt.id;
            optionCounts[key] = 0;
          });

          answers.forEach(a => {
            if (Array.isArray(a.answer)) {
              a.answer.forEach((selectedValue: any) => {
                const valueStr = String(selectedValue);
                // Try to find matching option
                const matchingOpt = regularOptions.find(opt => 
                  opt.id === valueStr || opt.value === valueStr || opt.label === valueStr
                );
                if (matchingOpt) {
                  const key = matchingOpt.value || matchingOpt.label || matchingOpt.id;
                  optionCounts[key] = (optionCounts[key] || 0) + 1;
                } else {
                  // Fallback: use value directly
                  optionCounts[valueStr] = (optionCounts[valueStr] || 0) + 1;
                }
              });
            } else if (a.answer !== null && a.answer !== undefined) {
              // Single value
              const valueStr = String(a.answer);
              const matchingOpt = regularOptions.find(opt => 
                opt.id === valueStr || opt.value === valueStr || opt.label === valueStr
              );
              if (matchingOpt) {
                const key = matchingOpt.value || matchingOpt.label || matchingOpt.id;
                optionCounts[key] = (optionCounts[key] || 0) + 1;
              } else {
                optionCounts[valueStr] = (optionCounts[valueStr] || 0) + 1;
              }
            }
          });

          const chartData = regularOptions.map(opt => {
            const key = opt.value || opt.label || opt.id;
            const count = optionCounts[key] || 0;
            return {
              option: opt.label,
              count,
              percentage: answers.length > 0 ? Math.round((count / answers.length) * 100) : 0,
            };
          }).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

          return (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                {chartData.map((item) => (
                  <div key={item.option}>
                    {item.option}: {item.count} ({item.percentage}%)
                  </div>
                ))}
              </div>
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="option" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`${value} (${chartData.find(d => d.count === value)?.percentage}%)`, "Count"]} />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        }
      }
      case "Dropdown": {
        // Count occurrences of each answer, mapping values to labels
        const optionCounts: Record<string, number> = {};
        const options = question.options || [];
        
        answers.forEach(a => {
          const valueStr = String(a.answer || "");
          const matchingOpt = options.find(opt => 
            opt.id === valueStr || opt.value === valueStr || opt.label === valueStr
          );
          const key = matchingOpt ? (matchingOpt.value || matchingOpt.label || matchingOpt.id) : valueStr;
          optionCounts[key] = (optionCounts[key] || 0) + 1;
        });

        const chartData = Object.entries(optionCounts)
          .map(([key, count]) => {
            const opt = options.find(o => o.id === key || o.value === key || o.label === key);
            return {
              option: opt ? opt.label : key,
              count,
              percentage: Math.round((count / answers.length) * 100),
            };
          })
          .sort((a, b) => b.count - a.count);

        return (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              {chartData.map((item) => (
                <div key={item.option}>
                  {item.option}: {item.count} ({item.percentage}%)
                </div>
              ))}
            </div>
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="option" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value} (${chartData.find(d => d.count === value)?.percentage}%)`, "Count"]} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      }
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Response Summary by Question</h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
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
            {formatAnswerSummary(summary)}
          </div>
        </div>
      ))}
    </div>
  );
}

