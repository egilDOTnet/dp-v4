"use client";

import { useState, useEffect } from "react";

interface RFIQuestionOption {
  id: string;
  label: string;
  value: string | null;
  xAxis: boolean;
  yAxis: boolean;
  order: number;
}

interface RFIQuestion {
  id: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  scaleLabels: Record<string, string> | null;
  options?: RFIQuestionOption[];
}

interface RFIQuestionRendererProps {
  question: RFIQuestion;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export function RFIQuestionRenderer({
  question,
  value,
  onChange,
  error,
}: RFIQuestionRendererProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const renderQuestion = () => {
    switch (question.type) {
      case "YesNo":
        return (
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={localValue === true}
                onChange={() => handleChange(true)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-text-primary">Yes</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={localValue === false}
                onChange={() => handleChange(false)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-text-primary">No</span>
            </label>
          </div>
        );

      case "Dropdown":
        return (
          <select
            value={localValue || ""}
            onChange={(e) => handleChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select an option</option>
            {question.options
              ?.filter((opt) => !opt.xAxis && !opt.yAxis)
              .sort((a, b) => a.order - b.order)
              .map((option) => (
                <option key={option.id} value={option.value || option.label}>
                  {option.label}
                </option>
              ))}
          </select>
        );

      case "MultipleChoice":
        // Check if this is a grid-style multiple choice (has both xAxis and yAxis options)
        const xAxisOptions = question.options?.filter((opt) => opt.xAxis).sort((a, b) => a.order - b.order) || [];
        const yAxisOptions = question.options?.filter((opt) => opt.yAxis).sort((a, b) => a.order - b.order) || [];
        const regularOptions = question.options?.filter((opt) => !opt.xAxis && !opt.yAxis).sort((a, b) => a.order - b.order) || [];

        // If we have both xAxis and yAxis options, render as a grid
        if (xAxisOptions.length > 0 && yAxisOptions.length > 0) {
          // Value should be an object mapping yAxis option IDs to xAxis option values
          const gridValue = typeof localValue === "object" && localValue !== null && !Array.isArray(localValue) 
            ? localValue 
            : {};

          return (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-text-primary border-b border-border-primary"></th>
                    {xAxisOptions.map((xOption, index) => (
                      <th
                        key={xOption.id}
                        className={`py-3 text-center text-sm font-medium text-text-primary border-b border-border-primary ${
                          index === xAxisOptions.length - 1 ? "pr-6 pl-4" : "px-4"
                        }`}
                      >
                        {xOption.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yAxisOptions.map((yOption) => {
                    const yOptionValue = yOption.value || yOption.label;
                    const selectedXValue = gridValue[yOption.id] || gridValue[yOptionValue] || null;
                    
                    return (
                      <tr key={yOption.id} className="border-b border-border-primary">
                        <td className="px-6 py-4 text-sm font-medium text-text-primary">
                          {yOption.label}
                        </td>
                        {xAxisOptions.map((xOption, index) => {
                          const xOptionValue = xOption.value || xOption.label;
                          const radioName = `question-${question.id}-row-${yOption.id}`;
                          const isChecked = selectedXValue === xOptionValue;

                          return (
                            <td 
                              key={xOption.id} 
                              className={`py-4 text-center ${
                                index === xAxisOptions.length - 1 ? "pr-6 pl-4" : "px-4"
                              }`}
                            >
                              <label className="flex items-center justify-center cursor-pointer min-h-[2rem]">
                                <input
                                  type="radio"
                                  name={radioName}
                                  checked={isChecked}
                                  onChange={() => {
                                    const newValue = {
                                      ...gridValue,
                                      [yOption.id]: xOptionValue,
                                    };
                                    handleChange(newValue);
                                  }}
                                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        // Otherwise, render as regular checkboxes
        const selectedValues = Array.isArray(localValue) ? localValue : localValue ? [localValue] : [];
        return (
          <div className="space-y-2">
            {regularOptions.map((option) => (
              <label key={option.id} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value || option.label)}
                  onChange={(e) => {
                    const optionValue = option.value || option.label;
                    if (e.target.checked) {
                      handleChange([...selectedValues, optionValue]);
                    } else {
                      handleChange(selectedValues.filter((v) => v !== optionValue));
                    }
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="text-text-primary">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case "Scale":
        const scaleLabels = question.scaleLabels || {};
        const scalePoints = Object.keys(scaleLabels).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Check if all labels are empty (no labels provided)
        const hasLabels = scalePoints.some((point) => {
          const label = scaleLabels[point];
          return label && label.trim() !== "";
        });
        
        // If no labels, render horizontally
        if (!hasLabels) {
          return (
            <div className="flex flex-wrap gap-4">
              {scalePoints.map((point) => (
                <label key={point} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={point}
                    checked={localValue === point}
                    onChange={() => handleChange(point)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-text-primary">{point}</span>
                </label>
              ))}
            </div>
          );
        }
        
        // If labels exist, render vertically with labels
        return (
          <div className="space-y-2">
            {scalePoints.map((point) => (
              <label key={point} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={point}
                  checked={localValue === point}
                  onChange={() => handleChange(point)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-text-primary">
                  {point}: {scaleLabels[point]}
                </span>
              </label>
            ))}
          </div>
        );

      case "SingleText":
        return (
          <input
            type="text"
            value={localValue || ""}
            onChange={(e) => handleChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );

      case "MultilineText":
        return (
          <textarea
            value={localValue || ""}
            onChange={(e) => handleChange(e.target.value || null)}
            rows={4}
            className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          />
        );

      case "ContactDetails":
        // Contact details are handled on a separate page
        return (
          <div className="text-text-secondary italic">
            Contact details will be confirmed on the next page.
          </div>
        );

      default:
        return (
          <div className="text-text-secondary italic">
            Unknown question type: {question.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {question.title}
          {question.required && <span className="text-red-600 ml-1">*</span>}
        </h3>
        {question.description && (
          <p className="text-text-secondary text-sm mb-4">{question.description}</p>
        )}
      </div>
      {renderQuestion()}
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}

