"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Filter } from "lucide-react";
import { api, EvaluationRequirement, EvaluationProgress, EvaluationScore } from "@/lib/api";
import { LoadingSpinner, SearchBar, Card } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ScoreInput } from "./ScoreInput";
import { EvaluationNoteInput } from "./EvaluationNoteInput";
import { EvaluationQuestionInput } from "./EvaluationQuestionInput";
import { CompletionCelebrationModal } from "./CompletionCelebrationModal";

interface EvaluationScoringProps {
  projectId: string;
}

interface FocusedCell {
  requirementId: string;
  vendorResponseId: string;
}

export function EvaluationScoring({ projectId }: EvaluationScoringProps) {
  const [requirements, setRequirements] = useState<EvaluationRequirement[]>([]);
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{
    onlyUnanswered: boolean;
    withNotes: boolean;
    withQuestions: boolean;
    priority: ("Information" | "Mandatory" | "Important" | "Wish")[];
  }>({
    onlyUnanswered: false,
    withNotes: false,
    withQuestions: false,
    priority: [],
  });
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [scores, setScores] = useState<Map<string, EvaluationScore>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);
  const hasShownCelebration = useRef(false);
  const tableRef = useRef<HTMLDivElement>(null);
  // Map to store refs for expanded rows, keyed by "requirementId-vendorResponseId"
  const expandedRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  // Map to store refs for score cell tds, keyed by "requirementId-vendorResponseId"
  const scoreCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  // Handle click-outside detection
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      // Check if click is within the table
      if (tableRef.current && !tableRef.current.contains(target)) {
        // Click is outside the table, close all expanded rows
        setFocusedCell(null);
        return;
      }

      // Check if click is within any expanded row
      // If so, keep it open (don't close)
      // Note: expanded rows consist of two tr elements, so check both the ref row and its next sibling
      for (const expandedRow of expandedRowRefs.current.values()) {
        if (expandedRow && expandedRow.contains(target)) {
          return;
        }
        // Also check the next sibling row (notes/questions row)
        const nextRow = expandedRow.nextElementSibling;
        if (nextRow && nextRow instanceof HTMLTableRowElement && nextRow.contains(target)) {
          return;
        }
      }

      // Check if click is on a score cell (td)
      // If so, open its expanded row (this handles clicks that might not trigger focus)
      for (const cellElement of scoreCellRefs.current.values()) {
        if (cellElement && cellElement.contains(target)) {
          const requirementId = cellElement.getAttribute('data-requirement-id');
          const vendorResponseId = cellElement.getAttribute('data-vendor-response-id');
          if (requirementId && vendorResponseId) {
            setFocusedCell({
              requirementId,
              vendorResponseId,
            });
          }
          return;
        }
      }

      // Click is inside the table but not on an expanded row or score cell
      // Close all expanded rows
      setFocusedCell(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load initial data
  useEffect(() => {
    Promise.all([
      api.evaluation.requirements(projectId),
      api.evaluation.progress(projectId),
      api.evaluation.scores.list(projectId),
    ])
      .then(([reqs, prog, scoreList]) => {
        setRequirements(reqs);
        setProgress(prog);
        // Convert scores array to Map for quick lookup
        const scoresMap = new Map<string, EvaluationScore>();
        scoreList.forEach((score) => {
          const key = `${score.vendorResponseId}-${score.requirementId}`;
          scoresMap.set(key, score);
        });
        setScores(scoresMap);
      })
      .catch((err) => {
        setError(err.message || "Failed to load evaluation data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  // Get unique vendors from requirements
  const vendors = useMemo(() => {
    const vendorMap = new Map<string, { vendorResponseId: string; vendor: { id: string; name: string; anonymizedId: string } }>();
    requirements.forEach((req) => {
      req.vendorResponses.forEach((vr) => {
        if (!vendorMap.has(vr.vendorResponseId)) {
          vendorMap.set(vr.vendorResponseId, {
            vendorResponseId: vr.vendorResponseId,
            vendor: vr.vendor,
          });
        }
      });
    });
    return Array.from(vendorMap.values()).sort((a, b) => 
      a.vendor.anonymizedId.localeCompare(b.vendor.anonymizedId)
    );
  }, [requirements]);

  // Calculate total needed: number of requirements * number of vendors who have delivered results
  const totalNeeded = useMemo(() => {
    const vendorsWithResults = new Set<string>();
    requirements.forEach((req) => {
      req.vendorResponses.forEach((vr) => {
        vendorsWithResults.add(vr.vendorResponseId);
      });
    });
    return requirements.length * vendorsWithResults.size;
  }, [requirements]);

  // Helper function to check if all scores are completed given a scores map
  const checkAllScoresCompleted = useCallback((scoresMap: Map<string, EvaluationScore>) => {
    if (requirements.length === 0) return false;
    
    // Get all vendors who have delivered results
    const vendorsWithResults = new Set<string>();
    requirements.forEach((req) => {
      req.vendorResponses.forEach((vr) => {
        vendorsWithResults.add(vr.vendorResponseId);
      });
    });

    // Check if every requirement has a score for every vendor with results
    for (const req of requirements) {
      for (const vendorResponseId of vendorsWithResults) {
        const vendorResponse = req.vendorResponses.find(
          (vr) => vr.vendorResponseId === vendorResponseId
        );
        if (!vendorResponse) continue; // Skip if vendor doesn't have a response for this requirement
        
        const key = `${vendorResponseId}-${req.id}`;
        const score = scoresMap.get(key);
        if (!score || score.score === null) {
          return false; // Found a missing score
        }
      }
    }
    
    return true; // All scores are completed
  }, [requirements]);

  // Check if all scores are completed
  const isAllScoresCompleted = useMemo(() => {
    return checkAllScoresCompleted(scores);
  }, [scores, checkAllScoresCompleted]);

  // Helper function to remove spaces and count characters
  const countCharsWithoutSpaces = (str: string): number => {
    return str.replace(/\s/g, '').length;
  };

  // Helper function to get first N characters without spaces
  const getFirstNCharsWithoutSpaces = (str: string, n: number): string => {
    let result = '';
    let charCount = 0;
    for (const char of str) {
      if (char !== ' ') {
        result += char;
        charCount++;
        if (charCount >= n) break;
      } else {
        result += char;
      }
    }
    return result.trim();
  };

  // Helper function to create shortened name from words
  const createShortenedName = (name: string, maxChars: number): string => {
    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return name;
    
    // If single word and <= maxChars, return it
    if (words.length === 1) {
      const word = words[0];
      if (countCharsWithoutSpaces(word) <= maxChars) {
        return word;
      }
      return word.substring(0, maxChars);
    }

    // Try first word only if it's <= maxChars
    const firstWord = words[0];
    if (countCharsWithoutSpaces(firstWord) <= maxChars) {
      return firstWord;
    }

    // Need to combine words
    // Try to split characters between words
    const totalChars = countCharsWithoutSpaces(name);
    if (totalChars <= maxChars) {
      return name.replace(/\s/g, '');
    }

    // Calculate how many chars to take from each word
    // For 2 words, try to split roughly evenly
    if (words.length === 2) {
      const firstWordChars = countCharsWithoutSpaces(firstWord);
      const secondWordChars = countCharsWithoutSpaces(words[1]);
      
      // If first word alone is too long, take part of it
      if (firstWordChars > maxChars) {
        // Take first 4 chars from first word, rest from second
        const firstPart = firstWord.substring(0, Math.min(4, firstWordChars));
        const remaining = maxChars - firstPart.length;
        const secondPart = words[1].substring(0, Math.min(remaining, secondWordChars));
        return firstPart + secondPart;
      }
      
      // First word fits, add from second word
      const remaining = maxChars - firstWordChars;
      if (remaining > 0) {
        const secondPart = words[1].substring(0, Math.min(remaining, secondWordChars));
        return firstWord + secondPart;
      }
      return firstWord;
    }

    // For more than 2 words, take first word + first chars of remaining words
    let result = firstWord.substring(0, Math.min(4, firstWordChars));
    let remaining = maxChars - result.length;
    
    for (let i = 1; i < words.length && remaining > 0; i++) {
      const word = words[i];
      const wordChars = countCharsWithoutSpaces(word);
      const take = Math.min(remaining, wordChars, 4);
      result += word.substring(0, take);
      remaining -= take;
    }
    
    return result;
  };

  // Generate shortened vendor names with conflict resolution
  const vendorShortNames = useMemo(() => {
    const shortNames = new Map<string, string>();
    
    // First pass: try to use first word if it's <= 8 chars, otherwise use first 8 chars without spaces
    vendors.forEach((vendorEntry) => {
      const fullName = vendorEntry.vendor.name;
      const words = fullName.split(/\s+/).filter(w => w.length > 0);
      const nameWithoutSpaces = fullName.replace(/\s/g, '');
      const charCount = nameWithoutSpaces.length;
      
      let shortName: string;
      if (charCount <= 8) {
        // Use the whole name (without spaces) if it's 8 chars or less
        shortName = nameWithoutSpaces;
      } else if (words.length > 0 && words[0].length <= 8) {
        // Try using just the first word if it's <= 8 chars
        // This gives us "Eon" from "Eon Computing" if no conflicts
        shortName = words[0];
      } else {
        // Take first 8 chars (without spaces)
        shortName = nameWithoutSpaces.substring(0, 8);
      }
      
      shortNames.set(vendorEntry.vendorResponseId, shortName);
    });

    // Second pass: detect and resolve conflicts
    const nameToVendors = new Map<string, string[]>(); // shortName -> vendorResponseIds
    shortNames.forEach((shortName, vendorResponseId) => {
      if (!nameToVendors.has(shortName)) {
        nameToVendors.set(shortName, []);
      }
      nameToVendors.get(shortName)!.push(vendorResponseId);
    });

    // Resolve conflicts by creating unique shortened names (4+4 from words)
    nameToVendors.forEach((vendorIds, shortName) => {
      if (vendorIds.length > 1) {
        // Conflict detected - need to make unique
        vendorIds.forEach((vendorResponseId) => {
          const vendorEntry = vendors.find(v => v.vendorResponseId === vendorResponseId);
          if (!vendorEntry) return;
          
          const fullName = vendorEntry.vendor.name;
          const words = fullName.split(/\s+/).filter(w => w.length > 0);
          
          if (words.length >= 2) {
            // Take 4 chars from first word + 4 from second word
            const firstPart = words[0].substring(0, Math.min(4, words[0].length));
            const secondPart = words[1].substring(0, Math.min(4, words[1].length));
            const newShortName = firstPart + secondPart;
            shortNames.set(vendorResponseId, newShortName);
          } else if (words.length === 1) {
            // Single word - take first 8 chars
            shortNames.set(vendorResponseId, words[0].substring(0, Math.min(8, words[0].length)));
          }
        });
      }
    });

    // Third pass: ensure all names are unique (handle remaining conflicts)
    const finalNameToVendors = new Map<string, string[]>();
    shortNames.forEach((shortName, vendorResponseId) => {
      if (!finalNameToVendors.has(shortName)) {
        finalNameToVendors.set(shortName, []);
      }
      finalNameToVendors.get(shortName)!.push(vendorResponseId);
    });

    finalNameToVendors.forEach((vendorIds, shortName) => {
      if (vendorIds.length > 1) {
        // Still have conflicts - make them unique by taking more chars
        vendorIds.forEach((vendorResponseId, index) => {
          const vendorEntry = vendors.find(v => v.vendorResponseId === vendorResponseId);
          if (!vendorEntry) return;
          
          const fullName = vendorEntry.vendor.name;
          const words = fullName.split(/\s+/).filter(w => w.length > 0);
          
          if (words.length >= 2) {
            // Take 4 from first, then try to make second part unique
            const firstPart = words[0].substring(0, Math.min(4, words[0].length));
            let secondPart = words[1].substring(0, Math.min(4, words[1].length));
            
            // Try to find a unique combination by taking more from second word
            let uniqueName = firstPart + secondPart;
            let attempt = 0;
            
            // Check if this name conflicts with others (excluding current vendor)
            const otherVendorIds = vendorIds.filter(id => id !== vendorResponseId);
            const otherNames = otherVendorIds.map(id => shortNames.get(id)).filter(Boolean) as string[];
            const usedNames = new Set(otherNames);
            
            while (usedNames.has(uniqueName) && attempt < 5 && secondPart.length < words[1].length) {
              secondPart = words[1].substring(0, Math.min(4 + attempt + 1, words[1].length));
              uniqueName = firstPart + secondPart;
              attempt++;
            }
            
            shortNames.set(vendorResponseId, uniqueName);
          } else if (words.length === 1) {
            // Single word - take more chars to make unique
            const word = words[0];
            let uniqueName = word.substring(0, Math.min(8, word.length));
            let attempt = 0;
            
            // Check if this name conflicts with others (excluding current vendor)
            const otherVendorIds = vendorIds.filter(id => id !== vendorResponseId);
            const otherNames = otherVendorIds.map(id => shortNames.get(id)).filter(Boolean) as string[];
            const usedNames = new Set(otherNames);
            
            while (usedNames.has(uniqueName) && attempt < 3 && uniqueName.length < word.length) {
              uniqueName = word.substring(0, Math.min(8 + attempt, word.length));
              attempt++;
            }
            
            shortNames.set(vendorResponseId, uniqueName);
          }
        });
      }
    });

    return shortNames;
  }, [vendors]);

  // Helper function to parse requirement number for sorting (e.g., "3.1.2." -> [3, 1, 2])
  const parseRequirementNumber = (num: string): number[] => {
    return num
      .replace(/\.$/, '') // Remove trailing period
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  };

  // Helper function to compare requirement numbers
  const compareRequirementNumbers = (a: string, b: string): number => {
    const aParts = parseRequirementNumber(a);
    const bParts = parseRequirementNumber(b);
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  };

  // Group requirements by hierarchy - flatten to show level 1 once, then all its level 2s
  const groupedRequirements = useMemo(() => {
    // First, group by level 1
    const level1Groups = new Map<string, {
      level1: { id: string; number: string; title: string };
      level2Groups: Map<string, {
        level2: { id: string; number: string; title: string };
        requirements: EvaluationRequirement[];
      }>;
      directRequirements: EvaluationRequirement[]; // Requirements directly under level 1
    }>();

    requirements.forEach((req) => {
      const level1Id = req.hierarchy.parent?.id || req.hierarchy.id;
      const level1 = req.hierarchy.parent || {
        id: req.hierarchy.id,
        number: req.hierarchy.number,
        title: req.hierarchy.title,
      };
      const level2 = req.hierarchy.parent ? {
        id: req.hierarchy.id,
        number: req.hierarchy.number,
        title: req.hierarchy.title,
      } : null;

      if (!level1Groups.has(level1Id)) {
        level1Groups.set(level1Id, {
          level1,
          level2Groups: new Map(),
          directRequirements: [],
        });
      }

      const group = level1Groups.get(level1Id)!;

      if (level2) {
        // Requirement is under a level 2 hierarchy
        if (!group.level2Groups.has(level2.id)) {
          group.level2Groups.set(level2.id, {
            level2,
            requirements: [],
          });
        }
        group.level2Groups.get(level2.id)!.requirements.push(req);
      } else {
        // Requirement is directly under level 1
        group.directRequirements.push(req);
      }
    });

    // Convert to flat array: level1 header, then level2 headers with requirements, then direct requirements
    const result: Array<{
      level1: { id: string; number: string; title: string };
      level2: { id: string; number: string; title: string } | null;
      requirements: EvaluationRequirement[];
    }> = [];

    const sortedLevel1Groups = Array.from(level1Groups.values()).sort((a, b) =>
      compareRequirementNumbers(a.level1.number, b.level1.number)
    );

    sortedLevel1Groups.forEach((group) => {
      // Sort level 2 groups
      const sortedLevel2Groups = Array.from(group.level2Groups.values()).sort((a, b) =>
        compareRequirementNumbers(a.level2.number, b.level2.number)
      );

      // Sort requirements within each level 2 group
      sortedLevel2Groups.forEach((level2Group) => {
        level2Group.requirements.sort((a, b) =>
          compareRequirementNumbers(a.number, b.number)
        );
        result.push({
          level1: group.level1,
          level2: level2Group.level2,
          requirements: level2Group.requirements,
        });
      });

      // Add direct requirements under level 1 (if any)
      if (group.directRequirements.length > 0) {
        group.directRequirements.sort((a, b) =>
          compareRequirementNumbers(a.number, b.number)
        );
        result.push({
          level1: group.level1,
          level2: null,
          requirements: group.directRequirements,
        });
      }
    });

    return result;
  }, [requirements]);

  // Filter requirements based on search and toggle
  const filteredGroups = useMemo(() => {
    let filtered = groupedRequirements;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map((group) => ({
        ...group,
        requirements: group.requirements.filter((req) => {
          const matchesNumber = req.number.toLowerCase().includes(query);
          const matchesDescription = req.description.toLowerCase().includes(query);
          const matchesResponse = req.vendorResponses.some((vr) => {
            const matchesAnswer = vr.answer?.toLowerCase().includes(query);
            const matchesDesc = vr.description?.toLowerCase().includes(query);
            const matchesRef = vr.reference?.toLowerCase().includes(query);
            return matchesAnswer || matchesDesc || matchesRef;
          });
          // Check notes and questions in scores
          const matchesNotes = Array.from(scores.values()).some((score) => {
            if (score.requirementId === req.id) {
              return score.note?.toLowerCase().includes(query) || 
                     score.question?.toLowerCase().includes(query);
            }
            return false;
          });
          return matchesNumber || matchesDescription || matchesResponse || matchesNotes;
        }),
      })).filter((group) => group.requirements.length > 0);
    }

    // Apply filters
    if (filters.onlyUnanswered || filters.withNotes || filters.withQuestions || filters.priority.length > 0) {
      filtered = filtered.map((group) => ({
        ...group,
        requirements: group.requirements.filter((req) => {
          // Priority filter
          if (filters.priority.length > 0) {
            if (!filters.priority.includes(req.type)) return false;
          }

          // Only unanswered filter
          if (filters.onlyUnanswered) {
            const allScored = req.vendorResponses.every((vr) => {
              const key = `${vr.vendorResponseId}-${req.id}`;
              const score = scores.get(key);
              return score && score.score !== null;
            });
            if (allScored) return false;
          }

          // With notes filter
          if (filters.withNotes) {
            const hasNote = req.vendorResponses.some((vr) => {
              const key = `${vr.vendorResponseId}-${req.id}`;
              const score = scores.get(key);
              return score && score.note && score.note.trim() !== "";
            });
            if (!hasNote) return false;
          }

          // With questions filter
          if (filters.withQuestions) {
            const hasQuestion = req.vendorResponses.some((vr) => {
              const key = `${vr.vendorResponseId}-${req.id}`;
              const score = scores.get(key);
              return score && score.question && score.question.trim() !== "";
            });
            if (!hasQuestion) return false;
          }

          return true;
        }),
      })).filter((group) => group.requirements.length > 0);
    }

    return filtered;
  }, [groupedRequirements, searchQuery, filters, scores]);

  // Handle score change
  const handleScoreChange = useCallback(async (
    requirementId: string,
    vendorResponseId: string,
    score: number | null
  ) => {
    const key = `${vendorResponseId}-${requirementId}`;
    const existingScore = scores.get(key);
    const existingScoreValue = existingScore?.score ?? null;
    
    // Skip save if the score hasn't changed
    if (existingScoreValue === score) {
      return;
    }
    
    setSaving((prev) => new Set(prev).add(key));
    
    // Ensure the cell stays focused when changing score
    setFocusedCell({
      requirementId,
      vendorResponseId,
    });

    try {
      const updatedScore = await api.evaluation.scores.create(projectId, {
        vendorResponseId,
        requirementId,
        score,
        note: existingScore?.note ?? null, // Preserve existing note
        question: existingScore?.question ?? null, // Preserve existing question
      });

      // Create updated scores map
      const newScores = new Map(scores);
      if (score === null) {
        // Delete score
        newScores.delete(key);
      } else {
        newScores.set(key, updatedScore);
      }

      // Update scores state
      setScores(newScores);

      // Refresh progress
      const newProgress = await api.evaluation.progress(projectId);
      setProgress(newProgress);

      // Check if all scores are now completed after this save
      // Only show celebration if this save completed all scores
      if (checkAllScoresCompleted(newScores) && !hasShownCelebration.current) {
        hasShownCelebration.current = true;
        // Small delay to ensure the UI has updated
        setTimeout(() => {
          setShowCelebration(true);
        }, 300);
      }
    } catch (err) {
      console.error("Failed to save score:", err);
      // TODO: Show error toast
    } finally {
      setSaving((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [projectId, scores, checkAllScoresCompleted]);

  // Reset celebration flag when scores become incomplete, so celebration can trigger again
  useEffect(() => {
    if (!isAllScoresCompleted) {
      hasShownCelebration.current = false;
      setShowCelebration(false);
    }
  }, [isAllScoresCompleted]);

  // Handle note change
  const handleNoteChange = useCallback(async (
    requirementId: string,
    vendorResponseId: string,
    note: string | null
  ) => {
    const key = `${vendorResponseId}-${requirementId}`;
    const existingScore = scores.get(key);
    
    setSaving((prev) => new Set(prev).add(key));

    try {
      const updatedScore = await api.evaluation.scores.create(projectId, {
        vendorResponseId,
        requirementId,
        score: existingScore?.score ?? null,
        note,
        question: existingScore?.question ?? null, // Preserve existing question
      });

      setScores((prev) => {
        const newScores = new Map(prev);
        newScores.set(key, updatedScore);
        return newScores;
      });

      // Refresh progress
      const newProgress = await api.evaluation.progress(projectId);
      setProgress(newProgress);
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSaving((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [projectId, scores]);

  // Handle question change
  const handleQuestionChange = useCallback(async (
    requirementId: string,
    vendorResponseId: string,
    question: string | null
  ) => {
    const key = `${vendorResponseId}-${requirementId}`;
    const existingScore = scores.get(key);
    
    setSaving((prev) => new Set(prev).add(key));

    try {
      const updatedScore = await api.evaluation.scores.create(projectId, {
        vendorResponseId,
        requirementId,
        score: existingScore?.score ?? null,
        note: existingScore?.note ?? null, // Preserve existing note
        question,
      });

      setScores((prev) => {
        const newScores = new Map(prev);
        newScores.set(key, updatedScore);
        return newScores;
      });

      // Refresh progress
      const newProgress = await api.evaluation.progress(projectId);
      setProgress(newProgress);
    } catch (err) {
      console.error("Failed to save question:", err);
    } finally {
      setSaving((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [projectId, scores]);

  // Get score for a requirement-vendor pair
  const getScore = (requirementId: string, vendorResponseId: string): EvaluationScore | null => {
    const key = `${vendorResponseId}-${requirementId}`;
    return scores.get(key) || null;
  };

  // Get vendor response for a requirement-vendor pair
  const getVendorResponse = (requirement: EvaluationRequirement, vendorResponseId: string) => {
    return requirement.vendorResponses.find((vr) => vr.vendorResponseId === vendorResponseId);
  };

  // Note: Tab navigation is handled by browser default behavior through the ScoreInput component
  // The ScoreInput component allows Tab to move to the next input naturally

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (requirements.length === 0) {
    return (
      <div className="text-center text-text-secondary py-12">
        <p>No requirements available for evaluation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      {progress && (
        <div className="bg-background-secondary p-4 rounded-lg border border-border-primary">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-text-secondary">Total Needed</div>
              <div className="text-lg font-bold text-text-primary">{totalNeeded}</div>
            </div>
            <div>
              <div className="text-text-secondary">Progress</div>
              <div className="text-lg font-bold text-text-primary">
                {progress.completed} ({progress.percentage}%)
              </div>
            </div>
            <div>
              <div className="text-text-secondary">Notes</div>
              <div className="text-lg font-bold text-text-primary">{progress.notesCount}</div>
            </div>
            <div>
              <div className="text-text-secondary">Questions</div>
              <div className="text-lg font-bold text-text-primary">{progress.questionsCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center relative z-20">
        <div className="w-full sm:w-1/2">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search requirements, responses, notes, questions..."
          />
        </div>
        <div className="flex justify-end w-full sm:w-auto sm:ml-auto">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`px-4 py-2 border border-border-primary rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2 ${
                  (filters.onlyUnanswered || filters.withNotes || filters.withQuestions || filters.priority.length > 0)
                    ? "bg-accent-600 text-white hover:bg-accent-700"
                    : "bg-background-secondary text-text-primary hover:bg-background-tertiary"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filter
                {(filters.onlyUnanswered || filters.withNotes || filters.withQuestions || filters.priority.length > 0) && (
                  <span className="px-1.5 py-0.5 bg-white text-black text-xs rounded-full font-semibold">
                    {(filters.onlyUnanswered ? 1 : 0) +
                     (filters.withNotes ? 1 : 0) +
                     (filters.withQuestions ? 1 : 0) +
                     filters.priority.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuCheckboxItem
                checked={filters.onlyUnanswered}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, onlyUnanswered: checked as boolean }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                Only unanswered
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.priority.includes("Information")}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: checked
                      ? [...prev.priority, "Information"]
                      : prev.priority.filter((p) => p !== "Information"),
                  }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                Priority: Information
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.priority.includes("Mandatory")}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: checked
                      ? [...prev.priority, "Mandatory"]
                      : prev.priority.filter((p) => p !== "Mandatory"),
                  }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                Priority: Mandatory
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.priority.includes("Important")}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: checked
                      ? [...prev.priority, "Important"]
                      : prev.priority.filter((p) => p !== "Important"),
                  }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                Priority: Important
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.priority.includes("Wish")}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: checked
                      ? [...prev.priority, "Wish"]
                      : prev.priority.filter((p) => p !== "Wish"),
                  }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                Priority: Wish
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.withNotes}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, withNotes: checked as boolean }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                With Notes
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.withQuestions}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, withQuestions: checked as boolean }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                With Questions
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Background layer to hide scrolling content above header */}
      <div 
        className="sticky w-full -mt-4" 
        style={{ 
          position: "sticky", 
          top: 0, 
          zIndex: 10, 
          height: "1rem", 
          backgroundColor: "var(--color-background-primary)" 
        }} 
      />
      {/* Table in Card - no overflow on parent to allow viewport sticky */}
      <Card className="p-0">
        <div ref={tableRef}>
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead className="bg-background-tertiary">
              <tr>
              <th className="sticky z-20 bg-background-tertiary px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-auto align-top rounded-tl-lg" style={{ position: "sticky", top: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 -2px 0 var(--color-primary-600)" }}>
                Req. #
              </th>
              <th className="sticky z-20 bg-background-tertiary px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider min-w-[300px] align-top" style={{ position: "sticky", top: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 -2px 0 var(--color-primary-600)" }}>
                Requirement
              </th>
              <th className="sticky z-20 bg-background-tertiary px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider min-w-[100px] align-top" style={{ position: "sticky", top: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 -2px 0 var(--color-primary-600)" }}>
                Priority
              </th>
              {vendors.map((vendorEntry, vendorIndex) => {
                const shortName = vendorShortNames.get(vendorEntry.vendorResponseId) || vendorEntry.vendor.name;
                return (
                  <th
                    key={vendorEntry.vendorResponseId}
                    className={`sticky z-20 bg-background-tertiary px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider min-w-[80px] align-top ${vendorIndex === vendors.length - 1 ? "rounded-tr-lg" : ""}`}
                    style={{ position: "sticky", top: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 -2px 0 var(--color-primary-600)" }}
                    title={vendorEntry.vendor.name}
                  >
                    {shortName}
                  </th>
                );
              })}
              </tr>
            </thead>
            <tbody className="bg-background-secondary">
              {filteredGroups.map((group, groupIndex) => {
                const allRequirements = filteredGroups.flatMap((g) => g.requirements);
                return (
                  <React.Fragment key={`${group.level1.id}-${group.level2?.id || "none"}`}>
                    {/* Level 1 Hierarchy Header (only show if this is the first group for this level 1) */}
                    {(() => {
                      const isFirstGroupForLevel1 = groupIndex === 0 || 
                        filteredGroups[groupIndex - 1].level1.id !== group.level1.id;
                      // Only make level 1 sticky if there's no level 2 hierarchy
                      const shouldStick = isFirstGroupForLevel1 && !group.level2;
                      return isFirstGroupForLevel1 ? (
                        <tr className="bg-background-tertiary border-t border-border-primary">
                          <td
                            colSpan={1}
                            className={`bg-background-tertiary font-semibold px-4 py-2 border-b border-border-primary ${shouldStick ? "sticky top-[calc(1rem+39px)] z-15" : ""}`}
                            style={shouldStick ? { position: "sticky", top: "calc(1rem + 39px)" } : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-primary-600 font-bold">{group.level1.number}</span>
                            </div>
                          </td>
                          <td
                            colSpan={2 + vendors.length}
                            className={`bg-background-tertiary font-semibold px-4 py-2 border-b border-border-primary ${shouldStick ? "sticky top-[calc(1rem+39px)] z-15" : ""}`}
                            style={shouldStick ? { position: "sticky", top: "calc(1rem + 39px)" } : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{group.level1.title}</span>
                            </div>
                          </td>
                        </tr>
                      ) : null;
                    })()}
                    {/* Level 2 Hierarchy Header (if exists) - always sticky */}
                    {group.level2 && (
                      <tr className="bg-background-secondary border-t border-border-primary">
                        <td
                          colSpan={1}
                          className="sticky top-[calc(1rem+39px)] z-14 bg-background-secondary font-medium px-4 py-2 align-top border-b border-border-primary"
                          style={{ position: "sticky", top: "calc(1rem + 39px)" }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-primary-600">{group.level2.number}</span>
                          </div>
                        </td>
                        <td
                          colSpan={2 + vendors.length}
                          className="sticky top-[calc(1rem+39px)] z-14 bg-background-secondary font-medium px-4 py-2 align-top border-b border-border-primary"
                          style={{ position: "sticky", top: "calc(1rem + 39px)" }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{group.level2.title}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* Requirements */}
                    {group.requirements.map((req, reqIndex) => {
                      const globalReqIndex = allRequirements.findIndex((r) => r.id === req.id);
                      const isFirstRequirement = reqIndex === 0;
                      const isLastRequirement = reqIndex === group.requirements.length - 1;
                      const isLastGroup = groupIndex === filteredGroups.length - 1;
                      const isLastRow = isLastGroup && isLastRequirement;
                      return (
                        <React.Fragment key={req.id}>
                          <tr className="border-t border-border-primary">
                            <td className={`px-4 py-4 text-sm text-text-primary text-left align-top border-b border-border-primary ${isLastRow ? "rounded-bl-lg" : ""}`}>
                              {req.number}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-primary max-w-[300px] align-top border-b border-border-primary">
                              <div className="line-clamp-2">{req.description}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-text-primary align-top border-b border-border-primary">
                              <span className="text-xs px-2 py-1 rounded bg-background-tertiary">
                                {req.type}
                              </span>
                            </td>
                            {vendors.map((vendorEntry, vendorIndex) => {
                              const isLastVendor = vendorIndex === vendors.length - 1;
                              const vendorResponse = getVendorResponse(req, vendorEntry.vendorResponseId);
                              if (!vendorResponse) {
                                return (
                                  <td key={vendorEntry.vendorResponseId} className={`px-4 py-4 text-sm text-text-primary text-center align-top border-b border-border-primary ${isLastRow && isLastVendor ? "rounded-br-lg" : ""}`}>
                                    <span className="text-text-tertiary text-xs">—</span>
                                  </td>
                                );
                              }

                              const score = getScore(req.id, vendorResponse.vendorResponseId);
                              const hasAnswer = score && score.score !== null;
                              const hasNote = score && score.note && score.note.trim() !== "";
                              const hasQuestion = score && score.question && score.question.trim() !== "";
                              const key = `${vendorResponse.vendorResponseId}-${req.id}`;

                              const cellKey = `${req.id}-${vendorResponse.vendorResponseId}`;
                              const isFocused = focusedCell?.requirementId === req.id &&
                                                focusedCell?.vendorResponseId === vendorResponse.vendorResponseId;
                              
                              return (
                                <td
                                  key={vendorEntry.vendorResponseId}
                                  ref={(el) => {
                                    if (el) {
                                      scoreCellRefs.current.set(cellKey, el);
                                    } else {
                                      scoreCellRefs.current.delete(cellKey);
                                    }
                                  }}
                                  data-requirement-id={req.id}
                                  data-vendor-response-id={vendorResponse.vendorResponseId}
                                  className={`px-4 py-4 text-sm text-text-primary text-center align-top ${isFocused ? 'bg-background-tertiary border-b-0 border-l border-r border-border-primary' : 'border-b border-border-primary'} ${isLastRow && isLastVendor && !isFocused ? "rounded-br-lg" : ""}`}
                                  onFocus={(e) => {
                                    // Update focusedCell when this cell or any child receives focus
                                    // This handles both direct td focus and focus on ScoreInput
                                    setFocusedCell({
                                      requirementId: req.id,
                                      vendorResponseId: vendorResponse.vendorResponseId,
                                    });
                                  }}
                                >
                                  <div className="flex items-center justify-center gap-1.5 min-h-[2.5rem]">
                                    {/* Left side - note indicator or invisible placeholder */}
                                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                      {hasNote && (
                                        <div 
                                          className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                          title="Has note"
                                        >
                                          n
                                        </div>
                                      )}
                                    </div>
                                    
                                    <ScoreInput
                                      value={score?.score ?? null}
                                      onChange={(newScore) =>
                                        handleScoreChange(req.id, vendorResponse.vendorResponseId, newScore)
                                      }
                                      placeholder="—"
                                      className={hasAnswer ? "bg-primary-50 dark:bg-primary-800 text-text-primary dark:text-gray-900" : ""}
                                    />
                                    
                                    {/* Right side - question indicator or invisible placeholder */}
                                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                      {hasQuestion && (
                                        <div 
                                          className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                          title="Has question"
                                        >
                                          q
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          {/* Vendor Response Display (when cell is focused) */}
                          {focusedCell && focusedCell.requirementId === req.id && (() => {
                            // Capture IDs at render time to ensure stable references
                            const currentRequirementId = req.id;
                            const currentVendorResponseId = focusedCell.vendorResponseId;
                            const focusedScore = getScore(currentRequirementId, currentVendorResponseId);
                            const expandedRowKey = `${currentRequirementId}-${currentVendorResponseId}`;
                            
                            // Create stable callbacks that use the captured IDs
                            const handleNoteChangeForRow = (note: string | null) => {
                              handleNoteChange(currentRequirementId, currentVendorResponseId, note);
                            };
                            
                            const handleQuestionChangeForRow = (question: string | null) => {
                              handleQuestionChange(currentRequirementId, currentVendorResponseId, question);
                            };
                            
                            const vendorResponse = getVendorResponse(req, currentVendorResponseId);
                            
                            return (
                              <React.Fragment key={`expanded-${expandedRowKey}`}>
                                {/* Requirement row - shows full requirement description */}
                                <tr 
                                  className="bg-background-tertiary border-t border-border-primary"
                                  data-expanded-row="true"
                                >
                                  <td colSpan={3 + vendors.length} className="px-4 py-4 align-top">
                                    <div className="text-xs font-semibold text-text-secondary mb-1">
                                      Requirement
                                    </div>
                                    <div className="text-sm text-text-primary whitespace-pre-wrap">
                                      {req.description}
                                    </div>
                                  </td>
                                </tr>
                                {/* Vendor Response row - aligns with table columns */}
                                <tr 
                                  ref={(el) => {
                                    if (el) {
                                      expandedRowRefs.current.set(expandedRowKey, el);
                                    } else {
                                      expandedRowRefs.current.delete(expandedRowKey);
                                    }
                                  }}
                                  className="bg-background-tertiary border-b border-border-primary"
                                  data-expanded-row="true"
                                >
                                  {/* Answer - Req.# column */}
                                  <td className="px-4 py-4 align-top">
                                    <div className="text-xs font-semibold text-text-secondary mb-1">
                                      Answer
                                    </div>
                                    <div className="text-sm text-text-primary">
                                      {vendorResponse?.answer || "—"}
                                    </div>
                                  </td>
                                  {/* Description - Requirement + Priority columns */}
                                  <td colSpan={2} className="px-4 py-4 align-top">
                                    <div className="text-xs font-semibold text-text-secondary mb-1">
                                      Description
                                    </div>
                                    <div className="text-sm text-text-primary whitespace-pre-wrap">
                                      {vendorResponse?.description || "—"}
                                    </div>
                                  </td>
                                  {/* Reference - All vendor columns */}
                                  <td colSpan={vendors.length} className="px-4 py-4 align-top">
                                    <div className="text-xs font-semibold text-text-secondary mb-1">
                                      Reference
                                    </div>
                                    <div className="text-sm text-text-primary whitespace-pre-wrap">
                                      {vendorResponse?.reference || "—"}
                                    </div>
                                  </td>
                                </tr>
                                {/* Notes and Questions row - spans all columns */}
                                <tr 
                                  className="bg-background-tertiary border-b border-border-primary"
                                  data-expanded-row="true"
                                >
                                  <td colSpan={3 + vendors.length} className="px-4 py-4 align-top">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-xs font-semibold text-text-secondary mb-1">
                                          Notes
                                        </div>
                                        <EvaluationNoteInput
                                          key={`note-${expandedRowKey}`}
                                          value={focusedScore?.note ?? null}
                                          onChange={handleNoteChangeForRow}
                                          placeholder="Add note..."
                                        />
                                      </div>
                                      <div>
                                        <div className="text-xs font-semibold text-text-secondary mb-1">
                                          Questions
                                        </div>
                                        <EvaluationQuestionInput
                                          key={`question-${expandedRowKey}`}
                                          value={focusedScore?.question ?? null}
                                          onChange={handleQuestionChangeForRow}
                                          placeholder="Add question..."
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={3 + vendors.length} className="px-4 py-12 text-sm text-text-primary text-center align-top">
                    {searchQuery ? "No requirements match your search." : "No requirements to display."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Celebration Modal */}
      <CompletionCelebrationModal
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
      />
    </div>
  );
}
