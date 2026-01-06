"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { api, EvaluationComparison, EvaluationHierarchyWeight, User, ProjectVendor, RequirementHierarchy, EvaluationScore, EvaluationRequirement } from "@/lib/api";
import { LoadingSpinner, SearchBar, Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Cell, LabelList } from "recharts";
import { ChevronDown, ChevronRight, Filter, Scale, ChevronLeft, X } from "lucide-react";

interface EvaluationCompareProps {
  projectId: string;
}

interface HierarchyGroup {
  id: string;
  number: string;
  title: string;
  parentId: string | null;
  level: 1 | 2;
  weight: number;
  children: HierarchyGroup[];
}

interface WeightedScore {
  actualScore: number;
  maxScore: number;
  percentage: number;
}

const TYPE_WEIGHTS: Record<"Information" | "Wish" | "Important" | "Mandatory", number> = {
  Information: 1,
  Wish: 2,
  Important: 3,
  Mandatory: 4,
};

const MAX_SCORE = 5;

// Helper function to format percentage - remove .0 if not needed
const formatPercentage = (value: number): string => {
  // Round to 1 decimal place first to handle floating point precision issues
  const rounded = Math.round(value * 10) / 10;
  // Check if it's effectively a whole number (within 0.01 tolerance)
  if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
    return `${Math.round(rounded)}%`;
  }
  return `${rounded.toFixed(1)}%`;
};

// Legend Item Component - manages its own hover state to prevent chart re-renders
interface LegendItemProps {
  entry: { value: string; color: string };
  hierarchy: HierarchyGroup | undefined;
  index: number;
}

function LegendItem({ entry, hierarchy, index }: LegendItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const number = hierarchy ? hierarchy.number : '';
  const fullLabel = hierarchy ? `${hierarchy.number} ${hierarchy.title}` : entry.value;

  return (
    <li 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-gray-300 bg-white cursor-pointer hover:bg-gray-50">
        <span 
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: entry.color }}
        />
        <span style={{ color: '#000000' }}>{number}</span>
      </div>
      
      {/* Tooltip on hover - below the legend item */}
      {isHovered && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md shadow-lg z-10 whitespace-nowrap pointer-events-none"
        >
          {/* Arrow pointing up */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-900"></div>
          {fullLabel}
        </div>
      )}
    </li>
  );
}

// Memoized Chart Components to prevent re-renders when table expands/collapses
interface AllTopLevelChartProps {
  groupedChartData: Array<Record<string, string | number>>;
  hierarchyGroups: HierarchyGroup[];
  hierarchyColors: Map<string, string>;
  formatPercentage: (value: number) => string;
}

const AllTopLevelChart = React.memo(function AllTopLevelChart({
  groupedChartData,
  hierarchyGroups,
  hierarchyColors,
  formatPercentage,
}: AllTopLevelChartProps) {
  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Score Comparison by Hierarchy</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={groupedChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} label={{ value: "Score (%)", angle: -90, position: "insideLeft" }} />
            <Legend 
              content={({ payload }) => (
                <ul className="flex flex-wrap justify-center gap-4 mt-4">
                  {payload?.map((entry, index) => {
                    const hierarchy = hierarchyGroups.find(h => h.id === entry.value);
                    return (
                      <LegendItem
                        key={`item-${index}`}
                        entry={entry}
                        hierarchy={hierarchy}
                        index={index}
                      />
                    );
                  })}
                </ul>
              )}
            />
            {hierarchyGroups.map((level1) => (
              <Bar 
                key={level1.id} 
                dataKey={level1.id} 
                fill={hierarchyColors.get(level1.id) || "#3b82f6"}
                name={level1.id}
              >
                <LabelList 
                  dataKey={level1.id} 
                  position="top" 
                  formatter={(value: number) => formatPercentage(value)}
                  content={({ value, x, y, width }) => (
                    <text
                      x={(x as number) + (width as number) / 2}
                      y={(y as number) - 5}
                      fill="#6b7280"
                      textAnchor="middle"
                      fontSize={12}
                    >
                      {formatPercentage(value as number)}
                    </text>
                  )}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

interface Level2GroupedChartProps {
  data: Array<Record<string, string | number>>;
  level1Hierarchy: HierarchyGroup;
  level2HierarchyColors: Map<string, string>;
  formatPercentage: (value: number) => string;
}

const Level2GroupedChart = React.memo(function Level2GroupedChart({
  data,
  level1Hierarchy,
  level2HierarchyColors,
  formatPercentage,
}: Level2GroupedChartProps) {
  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {level1Hierarchy.number} {level1Hierarchy.title}
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} label={{ value: "Score (%)", angle: -90, position: "insideLeft" }} />
            <Legend 
              content={({ payload }) => (
                <ul className="flex flex-wrap justify-center gap-4 mt-4">
                  {payload?.map((entry, index) => {
                    const hierarchy = level1Hierarchy.children.find(h => h.id === entry.value);
                    return (
                      <LegendItem
                        key={`item-${index}`}
                        entry={entry}
                        hierarchy={hierarchy}
                        index={index}
                      />
                    );
                  })}
                </ul>
              )}
            />
            {level1Hierarchy.children.map((level2) => (
              <Bar 
                key={level2.id} 
                dataKey={level2.id} 
                fill={level2HierarchyColors.get(level2.id) || "#3b82f6"}
                name={level2.id}
              >
                <LabelList 
                  dataKey={level2.id} 
                  position="top" 
                  formatter={(value: number) => formatPercentage(value)}
                  content={({ value, x, y, width }) => (
                    <text
                      x={(x as number) + (width as number) / 2}
                      y={(y as number) - 5}
                      fill="#6b7280"
                      textAnchor="middle"
                      fontSize={12}
                    >
                      {formatPercentage(value as number)}
                    </text>
                  )}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

interface SingleChartProps {
  chartData: Array<{ name: string; score: number; vendorId: string }>;
  title: string;
  vendorColors: Map<string, string>;
  formatPercentage: (value: number) => string;
}

const SingleChart = React.memo(function SingleChart({
  chartData,
  title,
  vendorColors,
  formatPercentage,
}: SingleChartProps) {
  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} label={{ value: "Score (%)", angle: -90, position: "insideLeft" }} />
            <Bar dataKey="score">
              {chartData.map((entry, index) => {
                // Use consistent color based on vendor ID, not index
                const color = vendorColors.get(entry.vendorId) || "#3b82f6";
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
              <LabelList 
                dataKey="score" 
                position="top" 
                formatter={(value: number) => formatPercentage(value)}
                content={({ value, x, y, width }) => (
                  <text
                    x={(x as number) + (width as number) / 2}
                    y={(y as number) - 5}
                    fill="#6b7280"
                    textAnchor="middle"
                    fontSize={12}
                  >
                    {formatPercentage(value as number)}
                  </text>
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

// Hierarchy Selector Component
interface HierarchySelectorProps {
  hierarchyGroups: HierarchyGroup[];
  selectedHierarchyId: string | null;
  onSelect: (hierarchyId: string) => void;
}

function HierarchySelector({ hierarchyGroups, selectedHierarchyId, onSelect }: HierarchySelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Flatten all hierarchies for search
  const allHierarchies = useMemo(() => {
    const flat: Array<{ id: string; number: string; title: string; level: 1 | 2; parentTitle?: string }> = [];
    hierarchyGroups.forEach((level1) => {
      flat.push({
        id: level1.id,
        number: level1.number,
        title: level1.title,
        level: 1,
      });
      level1.children.forEach((level2) => {
        flat.push({
          id: level2.id,
          number: level2.number,
          title: level2.title,
          level: 2,
          parentTitle: level1.title,
        });
      });
    });
    return flat;
  }, [hierarchyGroups]);

  // Filter hierarchies based on search
  const filteredHierarchies = useMemo(() => {
    if (!searchQuery.trim()) return allHierarchies;
    const query = searchQuery.toLowerCase();
    return allHierarchies.filter(
      (h) =>
        h.number.toLowerCase().includes(query) ||
        h.title.toLowerCase().includes(query) ||
        (h.parentTitle && h.parentTitle.toLowerCase().includes(query))
    );
  }, [allHierarchies, searchQuery]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, []);

  return (
    <>
      <div className="p-2 border-b border-border-primary">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search hierarchies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "a") {
              e.preventDefault();
              e.currentTarget.select();
              return;
            }
            if (e.key === "Escape") {
              e.stopPropagation();
            }
            e.stopPropagation();
          }}
          className="w-full px-3 py-2 border rounded-md text-text-primary bg-background-secondary border-border-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {filteredHierarchies.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-secondary">
            No hierarchies found
          </div>
        ) : (
          filteredHierarchies.map((hierarchy) => (
            <button
              key={hierarchy.id}
              type="button"
              onClick={() => {
                onSelect(hierarchy.id);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-background-tertiary transition-colors cursor-pointer ${
                selectedHierarchyId === hierarchy.id
                  ? "bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100"
                  : "text-text-primary"
              } ${hierarchy.level === 2 ? "pl-8" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{hierarchy.number}</span>
                <span>{hierarchy.title}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

export function EvaluationCompare({ projectId }: EvaluationCompareProps) {
  const [comparison, setComparison] = useState<EvaluationComparison[]>([]);
  const [hierarchyWeights, setHierarchyWeights] = useState<EvaluationHierarchyWeight[]>([]);
  const [hierarchies, setHierarchies] = useState<RequirementHierarchy[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [vendors, setVendors] = useState<Array<ProjectVendor & { anonymizedId?: string }>>([]);
  
  // Create map of vendor ID to anonymized ID
  const vendorAnonymizedMap = useMemo(() => {
    const map = new Map<string, string>();
    comparison.forEach((item) => {
      item.vendorData.forEach((vendor) => {
        if (!map.has(vendor.vendorId)) {
          map.set(vendor.vendorId, vendor.anonymizedId);
        }
      });
    });
    return map;
  }, [comparison]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showVendorNames, setShowVendorNames] = useState(false);
  const [filters, setFilters] = useState<{
    evaluatorIds?: string[];
    vendorIds?: string[];
    requirementFilter?: "all" | "withNotes" | "withQuestions" | "withNotesAndQuestions";
  }>({});
  const [scores, setScores] = useState<Map<string, EvaluationScore>>(new Map());
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [modalRequirementIndex, setModalRequirementIndex] = useState<number>(0);
  const [hierarchyViewMode, setHierarchyViewMode] = useState<"all-combined" | "all-top-level" | "specific">("all-combined");
  const [selectedHierarchyId, setSelectedHierarchyId] = useState<string | null>(null);
  const [expandedHierarchies, setExpandedHierarchies] = useState<Set<string>>(new Set());
  const [editingWeights, setEditingWeights] = useState<Map<string, string>>(new Map());
  const [savingWeights, setSavingWeights] = useState<Set<string>>(new Set());
  const [weightsModalOpen, setWeightsModalOpen] = useState(false);
  const [hoveredHierarchyId, setHoveredHierarchyId] = useState<string | null>(null);
  const weightInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Load all data
  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.evaluation.comparison(projectId, filters),
      api.evaluation.hierarchyWeights.list(projectId),
      api.projects.get(projectId),
      api.requirements.hierarchies.list(projectId).catch(() => []), // Fetch hierarchies as fallback
      api.evaluation.scores.list(projectId),
    ])
      .then(([comparisonData, weightsData, projectData, hierarchiesData, scoreList]) => {
        setComparison(comparisonData);
        setHierarchyWeights(weightsData);
        setHierarchies(hierarchiesData || []);
        setProjectMembers(projectData.members || []);
        // Convert scores array to Map for quick lookup
        const scoresMap = new Map<string, EvaluationScore>();
        scoreList.forEach((score) => {
          const key = `${score.vendorResponseId}-${score.requirementId}`;
          scoresMap.set(key, score);
        });
        setScores(scoresMap);
        // Extract vendors from comparison data
        const vendorMap = new Map<string, { id: string; name: string; anonymizedId: string }>();
        comparisonData.forEach((item) => {
          item.vendorData.forEach((vendor) => {
            if (!vendorMap.has(vendor.vendorId)) {
              vendorMap.set(vendor.vendorId, {
                id: vendor.vendorId,
                name: vendor.vendorName,
                anonymizedId: vendor.anonymizedId,
              });
            }
          });
        });
        setVendors(
          Array.from(vendorMap.values()).map((v) => ({
            id: v.id,
            name: v.name,
            organizationNumber: null,
            createdAt: "",
            updatedAt: "",
            anonymizedId: v.anonymizedId,
          }))
        );
      })
      .catch((err) => {
        setError(err.message || "Failed to load comparison data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId, filters]);

  // Reload comparison when filters change (weights are separate)
  useEffect(() => {
    if (!projectId) return;

    api.evaluation
      .comparison(projectId, filters)
      .then(setComparison)
      .catch((err) => {
        setError(err.message || "Failed to load comparison data");
      });
  }, [projectId, filters]);

  // Build hierarchy structure
  const hierarchyGroups = useMemo(() => {
    const groups = new Map<string, HierarchyGroup>();
    const level1Groups: HierarchyGroup[] = [];

    // Create a map of weights by hierarchy ID for quick lookup
    const weightMap = new Map<string, number>();
    hierarchyWeights.forEach((weight) => {
      weightMap.set(weight.hierarchyId, parseFloat(weight.weight));
    });

    // Always build from hierarchies list if available, then apply weights
    if (hierarchies.length > 0) {
      hierarchies.forEach((hierarchy) => {
        const weight = weightMap.get(hierarchy.id) ?? 1; // Default to 1 if no weight exists
        const group: HierarchyGroup = {
          id: hierarchy.id,
          number: hierarchy.number,
          title: hierarchy.title,
          parentId: hierarchy.parentId,
          level: hierarchy.parentId ? 2 : 1,
          weight: weight,
          children: [],
        };

        groups.set(hierarchy.id, group);
      });
    } else if (hierarchyWeights.length > 0) {
      // Fallback: build from weights if hierarchies aren't available yet
      hierarchyWeights.forEach((weight) => {
        const hierarchy = weight.hierarchy;
        const group: HierarchyGroup = {
          id: hierarchy.id,
          number: hierarchy.number,
          title: hierarchy.title,
          parentId: hierarchy.parentId,
          level: hierarchy.parentId ? 2 : 1,
          weight: parseFloat(weight.weight),
          children: [],
        };

        groups.set(hierarchy.id, group);
      });
    } else {
      // Build from comparison data if hierarchies aren't available
      const hierarchyMap = new Map<string, { id: string; number: string; title: string; parentId: string | null }>();
      comparison.forEach((item) => {
        const h = item.hierarchy;
        if (!hierarchyMap.has(h.id)) {
          hierarchyMap.set(h.id, {
            id: h.id,
            number: h.number,
            title: h.title,
            parentId: h.parentId,
          });
        }
        if (h.parent && !hierarchyMap.has(h.parent.id)) {
          hierarchyMap.set(h.parent.id, {
            id: h.parent.id,
            number: h.parent.number,
            title: h.parent.title,
            parentId: null,
          });
        }
      });

      hierarchyMap.forEach((h) => {
        const group: HierarchyGroup = {
          id: h.id,
          number: h.number,
          title: h.title,
          parentId: h.parentId,
          level: h.parentId ? 2 : 1,
          weight: 1, // Default weight when none exists (1x multiplier)
          children: [],
        };
        groups.set(h.id, group);
      });
    }

    // Build parent-child relationships
    groups.forEach((group) => {
      if (group.parentId && groups.has(group.parentId)) {
        groups.get(group.parentId)!.children.push(group);
      } else {
        level1Groups.push(group);
      }
    });

    // Sort by number
    const sortByNumber = (a: HierarchyGroup, b: HierarchyGroup) => {
      return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
    };

    level1Groups.sort(sortByNumber);
    level1Groups.forEach((group) => {
      group.children.sort(sortByNumber);
    });

    return level1Groups;
  }, [hierarchyWeights, hierarchies, comparison]);

  // Get hierarchy weight for a requirement's hierarchy
  const getHierarchyWeight = useMemo(() => {
    return (req: EvaluationComparison): number => {
      const reqHierarchyId = req.hierarchy.parent?.id || req.hierarchy.id;
      const level2Id = req.hierarchy.parent ? req.hierarchy.id : null;
      
      // Find the hierarchy group
      for (const level1 of hierarchyGroups) {
        if (level1.id === reqHierarchyId) {
          return level1.weight;
        }
        for (const level2 of level1.children) {
          if (level2.id === (level2Id || reqHierarchyId)) {
            return level2.weight;
          }
        }
      }
      return 1; // Default weight
    };
  }, [hierarchyGroups]);

  // Calculate weighted scores per vendor for a hierarchy
  const calculateWeightedScorePerVendor = (
    requirements: EvaluationComparison[],
    hierarchyId: string
  ): Map<string, number> => {
    const vendorPercentages = new Map<string, number>();

    // Get unique vendors
    const vendorIds = new Set<string>();
    requirements.forEach((req) => {
      req.vendorData.forEach((vendor) => {
        vendorIds.add(vendor.vendorId);
      });
    });

    vendorIds.forEach((vendorId) => {
      let vendorActualScore = 0;
      let vendorMaxScore = 0;

      requirements.forEach((req) => {
        // Filter by hierarchy
        if (req.hierarchy.id !== hierarchyId && req.hierarchy.parent?.id !== hierarchyId) {
          return;
        }

        // Get hierarchy weight multiplier (0 means exclude)
        const hierarchyWeight = getHierarchyWeight(req);
        if (hierarchyWeight === 0) {
          return; // Exclude from calculation
        }

        const typeWeight = TYPE_WEIGHTS[req.requirementType];
        const requirementMaxScore = typeWeight * MAX_SCORE * hierarchyWeight;
        vendorMaxScore += requirementMaxScore;

        const vendorData = req.vendorData.find((v) => v.vendorId === vendorId);
        if (vendorData && vendorData.scores.length > 0) {
          const avgScore =
            vendorData.average !== null && vendorData.average !== undefined
              ? vendorData.average
              : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
          vendorActualScore += avgScore * typeWeight * hierarchyWeight;
        }
      });

      const percentage = vendorMaxScore > 0 ? (vendorActualScore / vendorMaxScore) * 100 : 0;
      vendorPercentages.set(vendorId, percentage);
    });

    return vendorPercentages;
  };

  // Calculate weighted scores with hierarchy multipliers (averaged across vendors)
  const calculateWeightedScore = (
    requirements: EvaluationComparison[],
    hierarchyId?: string
  ): WeightedScore => {
    let totalActualScore = 0;
    let totalMaxScore = 0;

    // Get unique vendors
    const vendorIds = new Set<string>();
    requirements.forEach((req) => {
      req.vendorData.forEach((vendor) => {
        vendorIds.add(vendor.vendorId);
      });
    });

    // Calculate score for each vendor, then average
    const vendorScores: Array<{ actual: number; max: number }> = [];

    vendorIds.forEach((vendorId) => {
      let vendorActualScore = 0;
      let vendorMaxScore = 0;

      requirements.forEach((req) => {
        // Filter by hierarchy if specified
        if (hierarchyId && req.hierarchy.id !== hierarchyId && req.hierarchy.parent?.id !== hierarchyId) {
          return;
        }

        // Get hierarchy weight multiplier (0 means exclude)
        const hierarchyWeight = getHierarchyWeight(req);
        if (hierarchyWeight === 0) {
          return; // Exclude from calculation
        }

        const typeWeight = TYPE_WEIGHTS[req.requirementType];
        const requirementMaxScore = typeWeight * MAX_SCORE * hierarchyWeight;
        vendorMaxScore += requirementMaxScore;

        const vendorData = req.vendorData.find((v) => v.vendorId === vendorId);
        if (vendorData && vendorData.scores.length > 0) {
          const avgScore =
            vendorData.average !== null && vendorData.average !== undefined
              ? vendorData.average
              : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
          vendorActualScore += avgScore * typeWeight * hierarchyWeight;
        }
      });

      if (vendorMaxScore > 0) {
        vendorScores.push({ actual: vendorActualScore, max: vendorMaxScore });
      }
    });

    // Average across vendors
    if (vendorScores.length > 0) {
      totalActualScore = vendorScores.reduce((sum, s) => sum + s.actual, 0) / vendorScores.length;
      totalMaxScore = vendorScores.reduce((sum, s) => sum + s.max, 0) / vendorScores.length;
    }

    return {
      actualScore: totalActualScore,
      maxScore: totalMaxScore,
      percentage: totalMaxScore > 0 ? (totalActualScore / totalMaxScore) * 100 : 0,
    };
  };

  // Create mapping from vendorId to vendorResponseId using scores
  const vendorIdToResponseIdMap = useMemo(() => {
    const map = new Map<string, string>();
    scores.forEach((score) => {
      if (score.vendorResponse?.vendorId && score.vendorResponseId) {
        map.set(score.vendorResponse.vendorId, score.vendorResponseId);
      }
    });
    return map;
  }, [scores]);

  // Helper function to check if a requirement has notes/questions from selected evaluators
  const requirementHasNotesOrQuestions = useMemo(() => {
    return (requirementId: string, checkNotes: boolean, checkQuestions: boolean): boolean => {
      if (!checkNotes && !checkQuestions) return false;
      
      const selectedEvaluatorIds = filters.evaluatorIds && filters.evaluatorIds.length > 0
        ? filters.evaluatorIds
        : null; // null means check all evaluators
      
      // Check all scores for this requirement
      for (const [key, score] of scores.entries()) {
        if (score.requirementId !== requirementId) continue;
        
        // If evaluator filter is active, only check scores from selected evaluators
        if (selectedEvaluatorIds && !selectedEvaluatorIds.includes(score.evaluatedById)) {
          continue;
        }
        
        if (checkNotes && score.note && score.note.trim() !== "") {
          return true;
        }
        if (checkQuestions && score.question && score.question.trim() !== "") {
          return true;
        }
      }
      
      return false;
    };
  }, [scores, filters.evaluatorIds]);

  // Helper function to check if a requirement has notes/questions for a specific vendor
  const requirementHasNotesOrQuestionsForVendor = useMemo(() => {
    return (requirementId: string, vendorId: string, checkNotes: boolean, checkQuestions: boolean): boolean => {
      if (!checkNotes && !checkQuestions) return false;
      
      const vendorResponseId = vendorIdToResponseIdMap.get(vendorId);
      if (!vendorResponseId) return false;
      
      const selectedEvaluatorIds = filters.evaluatorIds && filters.evaluatorIds.length > 0
        ? filters.evaluatorIds
        : null;
      
      const key = `${vendorResponseId}-${requirementId}`;
      const score = scores.get(key);
      if (!score) return false;
      
      // If evaluator filter is active, only check scores from selected evaluators
      if (selectedEvaluatorIds && !selectedEvaluatorIds.includes(score.evaluatedById)) {
        return false;
      }
      
      if (checkNotes && score.note && score.note.trim() !== "") {
        return true;
      }
      if (checkQuestions && score.question && score.question.trim() !== "") {
        return true;
      }
      
      return false;
    };
  }, [scores, filters.evaluatorIds, vendorIdToResponseIdMap]);

  // Filter requirements (excluding hierarchies with weight 0)
  const filteredRequirements = useMemo(() => {
    // Get all child hierarchy IDs recursively
    const getAllChildHierarchyIds = (hierarchyId: string): Set<string> => {
      const ids = new Set<string>([hierarchyId]);
      hierarchyGroups.forEach((level1) => {
        if (level1.id === hierarchyId) {
          level1.children.forEach((level2) => {
            ids.add(level2.id);
          });
        }
      });
      return ids;
    };
    let filtered = comparison;

    // Exclude requirements from hierarchies with weight 0
    filtered = filtered.filter((req) => {
      const hierarchyWeight = getHierarchyWeight(req);
      return hierarchyWeight > 0;
    });

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((req) =>
        req.requirementDescription.toLowerCase().includes(query) ||
        req.requirementNumber.toLowerCase().includes(query)
      );
    }

    // Hierarchy filter based on view mode
    if (hierarchyViewMode === "specific" && selectedHierarchyId) {
      const allowedHierarchyIds = getAllChildHierarchyIds(selectedHierarchyId);
      filtered = filtered.filter(
        (req) =>
          allowedHierarchyIds.has(req.hierarchy.id) ||
          (req.hierarchy.parent && allowedHierarchyIds.has(req.hierarchy.parent.id))
      );
    }
    // "all-combined" and "all-top-level" show all hierarchies (no filtering)

    // Evaluator filter - filter to requirements that have scores from selected evaluators
    if (filters.evaluatorIds && filters.evaluatorIds.length > 0) {
      // This is handled in the requirement filter below via scores
    }

    // Requirement filter (notes/questions)
    if (filters.requirementFilter && filters.requirementFilter !== "all") {
      const checkNotes = filters.requirementFilter === "withNotes" || filters.requirementFilter === "withNotesAndQuestions";
      const checkQuestions = filters.requirementFilter === "withQuestions" || filters.requirementFilter === "withNotesAndQuestions";
      
      filtered = filtered.filter((req) => {
        return requirementHasNotesOrQuestions(req.requirementId, checkNotes, checkQuestions);
      });
    }

    // Vendor filter
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      filtered = filtered.filter((req) =>
        req.vendorData.some((v) => filters.vendorIds!.includes(v.vendorId))
      );
    }

    return filtered;
  }, [comparison, searchQuery, filters, hierarchyGroups, getHierarchyWeight, hierarchyViewMode, selectedHierarchyId, requirementHasNotesOrQuestions]);

  // Keyboard navigation for requirement modal - will be updated after requirementsInTableOrder is defined

  // Group requirements by hierarchy
  const requirementsByHierarchy = useMemo(() => {
    const groups = new Map<string, EvaluationComparison[]>();

    filteredRequirements.forEach((req) => {
      const hierarchyId = req.hierarchy.parent?.id || req.hierarchy.id;
      if (!groups.has(hierarchyId)) {
        groups.set(hierarchyId, []);
      }
      groups.get(hierarchyId)!.push(req);
    });

    return groups;
  }, [filteredRequirements]);

  // Filter hierarchy groups to only show those with matching requirements
  const filteredHierarchyGroups = useMemo(() => {
    // Create a set of hierarchy IDs that have matching requirements
    const matchingHierarchyIds = new Set<string>();
    filteredRequirements.forEach((req) => {
      // Add the requirement's hierarchy ID
      matchingHierarchyIds.add(req.hierarchy.id);
      // If it has a parent, add the parent ID too
      if (req.hierarchy.parent?.id) {
        matchingHierarchyIds.add(req.hierarchy.parent.id);
      }
    });

    // Filter level 1 hierarchies - show if they have matching requirements directly or through children
    return hierarchyGroups
      .map((level1) => {
        // Check if level1 has matching requirements directly (no parent or parent is null)
        const hasDirectMatches = filteredRequirements.some(
          (req) => req.hierarchy.id === level1.id && (req.hierarchy.parent === null || req.hierarchy.parent === undefined || !req.hierarchy.parent?.id)
        );

        // Check if any level2 children have matching requirements
        const matchingChildren = level1.children.filter((level2) =>
          matchingHierarchyIds.has(level2.id)
        );

        // Show level1 if it has direct matches or has children with matches
        if (hasDirectMatches || matchingChildren.length > 0) {
          return {
            ...level1,
            children: matchingChildren, // Only include children with matches
          };
        }
        return null;
      })
      .filter((level1): level1 is HierarchyGroup => level1 !== null);
  }, [hierarchyGroups, filteredRequirements]);

  // Get requirements in the same order as they appear in the detailed scores table
  const requirementsInTableOrder = useMemo(() => {
    const ordered: EvaluationComparison[] = [];
    
    filteredHierarchyGroups.forEach((level1) => {
      const level1Reqs = filteredRequirements.filter(
        (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
      );
      
      // Only process if level1 has requirements
      if (level1Reqs.length === 0) return;
      
      // Process level 2 hierarchies
      level1.children
        .filter((level2) => {
          const level2Reqs = filteredRequirements.filter(
            (req) => req.hierarchy.id === level2.id
          );
          return level2Reqs.length > 0;
        })
        .forEach((level2) => {
          const level2Reqs = filteredRequirements.filter(
            (req) => req.hierarchy.id === level2.id
          );
          // Sort by requirement number
          level2Reqs.sort((a, b) => 
            a.requirementNumber.localeCompare(b.requirementNumber, undefined, { numeric: true, sensitivity: "base" })
          );
          ordered.push(...level2Reqs);
        });
      
      // Requirements directly under level 1 (no level 2)
      const directLevel1Reqs = filteredRequirements.filter(
        (req) => req.hierarchy.id === level1.id && req.hierarchy.parentId === null
      );
      // Sort by requirement number
      directLevel1Reqs.sort((a, b) => 
        a.requirementNumber.localeCompare(b.requirementNumber, undefined, { numeric: true, sensitivity: "base" })
      );
      ordered.push(...directLevel1Reqs);
    });
    
    return ordered;
  }, [filteredHierarchyGroups, filteredRequirements]);

  // Keyboard navigation for requirement modal
  useRequirementModalKeyboard(
    selectedRequirementId,
    modalRequirementIndex,
    requirementsInTableOrder,
    setSelectedRequirementId,
    setModalRequirementIndex
  );

  // Filter vendors based on vendor filter
  const filteredVendors = useMemo(() => {
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      return vendors.filter((vendor) => filters.vendorIds!.includes(vendor.id));
    }
    return vendors;
  }, [vendors, filters.vendorIds]);

  // Generate shortened vendor names with conflict resolution (same logic as EvaluationScoring)
  const vendorShortNames = useMemo(() => {
    const shortNames = new Map<string, string>();
    
    // First pass: try to use first word if it's <= 8 chars, otherwise use first 8 chars without spaces
    vendors.forEach((vendor) => {
      const fullName = vendor.name;
      const words = fullName.split(/\s+/).filter(w => w.length > 0);
      const nameWithoutSpaces = fullName.replace(/\s/g, '');
      const charCount = nameWithoutSpaces.length;
      
      let shortName: string;
      if (charCount <= 8) {
        // Use the whole name (without spaces) if it's 8 chars or less
        shortName = nameWithoutSpaces;
      } else if (words.length > 0 && words[0].length <= 8) {
        // Try using just the first word if it's <= 8 chars
        shortName = words[0];
      } else {
        // Take first 8 chars (without spaces)
        shortName = nameWithoutSpaces.substring(0, 8);
      }
      
      shortNames.set(vendor.id, shortName);
    });

    // Second pass: detect and resolve conflicts
    const nameToVendors = new Map<string, string[]>(); // shortName -> vendorIds
    shortNames.forEach((shortName, vendorId) => {
      if (!nameToVendors.has(shortName)) {
        nameToVendors.set(shortName, []);
      }
      nameToVendors.get(shortName)!.push(vendorId);
    });

    // Resolve conflicts by creating unique shortened names (4+4 from words)
    nameToVendors.forEach((vendorIds, _shortName) => {
      if (vendorIds.length > 1) {
        // Conflict detected - need to make unique
        vendorIds.forEach((vendorId) => {
          const vendor = vendors.find(v => v.id === vendorId);
          if (!vendor) return;
          
          const fullName = vendor.name;
          const words = fullName.split(/\s+/).filter(w => w.length > 0);
          
          if (words.length >= 2) {
            // Take 4 chars from first word + 4 from second word
            const firstPart = words[0].substring(0, Math.min(4, words[0].length));
            const secondPart = words[1].substring(0, Math.min(4, words[1].length));
            const newShortName = firstPart + secondPart;
            shortNames.set(vendorId, newShortName);
          } else if (words.length === 1) {
            // Single word - take first 8 chars
            shortNames.set(vendorId, words[0].substring(0, Math.min(8, words[0].length)));
          }
        });
      }
    });

    // Third pass: ensure all names are unique (handle remaining conflicts)
    const finalNameToVendors = new Map<string, string[]>();
    shortNames.forEach((shortName, vendorId) => {
      if (!finalNameToVendors.has(shortName)) {
        finalNameToVendors.set(shortName, []);
      }
      finalNameToVendors.get(shortName)!.push(vendorId);
    });

    finalNameToVendors.forEach((vendorIds, _shortName) => {
      if (vendorIds.length > 1) {
        // Still have conflicts - make them unique by taking more chars
        vendorIds.forEach((vendorId) => {
          const vendor = vendors.find(v => v.id === vendorId);
          if (!vendor) return;
          
          const fullName = vendor.name;
          const words = fullName.split(/\s+/).filter(w => w.length > 0);
          
          if (words.length >= 2) {
            // Take 4 from first, then try to make second part unique
            const firstPart = words[0].substring(0, Math.min(4, words[0].length));
            let secondPart = words[1].substring(0, Math.min(4, words[1].length));
            
            // Try to find a unique combination by taking more from second word
            let uniqueName = firstPart + secondPart;
            let attempt = 0;
            
            // Check if this name conflicts with others (excluding current vendor)
            const otherVendorIds = vendorIds.filter(id => id !== vendorId);
            const otherNames = otherVendorIds.map(id => shortNames.get(id)).filter(Boolean) as string[];
            const usedNames = new Set(otherNames);
            
            while (usedNames.has(uniqueName) && attempt < 5 && secondPart.length < words[1].length) {
              secondPart = words[1].substring(0, Math.min(4 + attempt + 1, words[1].length));
              uniqueName = firstPart + secondPart;
              attempt++;
            }
            
            shortNames.set(vendorId, uniqueName);
          } else if (words.length === 1) {
            // Single word - take more chars to make unique
            const word = words[0];
            let uniqueName = word.substring(0, Math.min(8, word.length));
            let attempt = 0;
            
            // Check if this name conflicts with others (excluding current vendor)
            const otherVendorIds = vendorIds.filter(id => id !== vendorId);
            const otherNames = otherVendorIds.map(id => shortNames.get(id)).filter(Boolean) as string[];
            const usedNames = new Set(otherNames);
            
            while (usedNames.has(uniqueName) && attempt < 3 && uniqueName.length < word.length) {
              uniqueName = word.substring(0, Math.min(8 + attempt, word.length));
              attempt++;
            }
            
            shortNames.set(vendorId, uniqueName);
          }
        });
      }
    });

    return shortNames;
  }, [vendors]);

  // Color palette for vendors - consistent across all views
  const vendorColors = useMemo(() => {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#06b6d4", // cyan
      "#f97316", // orange
      "#ec4899", // pink
    ];
    
    // Create a stable color mapping based on vendor ID
    // Sort vendors by ID to ensure consistent ordering
    const sortedVendors = [...vendors].sort((a, b) => a.id.localeCompare(b.id));
    const colorMap = new Map<string, string>();
    
    sortedVendors.forEach((vendor, index) => {
      colorMap.set(vendor.id, colors[index % colors.length]);
    });
    
    return colorMap;
  }, [vendors]);

  // Color palette for hierarchies - consistent across all views
  const hierarchyColors = useMemo(() => {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#06b6d4", // cyan
      "#f97316", // orange
      "#ec4899", // pink
    ];
    
    // Create a stable color mapping based on hierarchy ID
    // Sort hierarchies by number to ensure consistent ordering
    const sortedHierarchies = [...hierarchyGroups].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const colorMap = new Map<string, string>();
    
    sortedHierarchies.forEach((hierarchy, index) => {
      colorMap.set(hierarchy.id, colors[index % colors.length]);
    });
    
    return colorMap;
  }, [hierarchyGroups]);

  // Color palette for level 2 hierarchies - used when showing level 1 with sub-hierarchies
  const level2HierarchyColors = useMemo(() => {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#06b6d4", // cyan
      "#f97316", // orange
      "#ec4899", // pink
    ];
    
    // Flatten all level 2 hierarchies and create color mapping
    const allLevel2 = hierarchyGroups.flatMap(level1 => level1.children);
    const sortedLevel2 = [...allLevel2].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const colorMap = new Map<string, string>();
    
    sortedLevel2.forEach((hierarchy, index) => {
      colorMap.set(hierarchy.id, colors[index % colors.length]);
    });
    
    return colorMap;
  }, [hierarchyGroups]);

  // Prepare chart data - one bar per vendor with total score
  // Helper function to calculate chart data for a set of requirements
  const calculateChartData = (
    requirements: EvaluationComparison[],
    vendorsToUse: Array<ProjectVendor & { anonymizedId?: string }>
  ): Array<{ name: string; score: number; vendorId: string }> => {
    const calculateVendorTotalScore = (vendorId: string): number => {
      let vendorActualScore = 0;
      let vendorMaxScore = 0;

      requirements.forEach((req) => {
        const hierarchyWeight = getHierarchyWeight(req);
        if (hierarchyWeight === 0) return;

        const typeWeight = TYPE_WEIGHTS[req.requirementType];
        const requirementMaxScore = typeWeight * MAX_SCORE * hierarchyWeight;
        vendorMaxScore += requirementMaxScore;

        const vendorData = req.vendorData.find((v) => v.vendorId === vendorId);
        if (vendorData && vendorData.scores.length > 0) {
          const avgScore =
            vendorData.average !== null && vendorData.average !== undefined
              ? vendorData.average
              : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
          vendorActualScore += avgScore * typeWeight * hierarchyWeight;
        }
      });

      return vendorMaxScore > 0 ? (vendorActualScore / vendorMaxScore) * 100 : 0;
    };

    const data: Array<{ name: string; score: number; vendorId: string }> = [];
    const sortedVendors = [...vendorsToUse].sort((a, b) => a.id.localeCompare(b.id));

    sortedVendors.forEach((vendor) => {
      const totalScore = calculateVendorTotalScore(vendor.id);
      const vendorLabel = showVendorNames
        ? vendorShortNames.get(vendor.id) || vendor.name
        : vendorAnonymizedMap.get(vendor.id) || `V${sortedVendors.indexOf(vendor) + 1}`;
      
      data.push({
        name: vendorLabel,
        score: totalScore,
        vendorId: vendor.id,
      });
    });

    return data;
  };

  const chartData = useMemo(() => {
    return calculateChartData(filteredRequirements, filteredVendors);
  }, [filteredRequirements, filteredVendors, showVendorNames, vendorAnonymizedMap, vendorShortNames, getHierarchyWeight]);

  // Calculate grouped chart data for "all-top-level" mode
  const groupedChartData = useMemo(() => {
    const sortedVendors = [...filteredVendors].sort((a, b) => a.id.localeCompare(b.id));
    
    // Create data structure: one entry per vendor with scores for each hierarchy
    const data = sortedVendors.map((vendor) => {
      const vendorLabel = showVendorNames
        ? vendorShortNames.get(vendor.id) || vendor.name
        : vendorAnonymizedMap.get(vendor.id) || `V${sortedVendors.indexOf(vendor) + 1}`;
      
      const entry: Record<string, string | number> = { name: vendorLabel };
      
      // Calculate score for each top-level hierarchy
      hierarchyGroups.forEach((level1) => {
        const hierarchyReqs = filteredRequirements.filter(
          (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
        );
        
        // Calculate score for this vendor in this hierarchy
        let vendorActualScore = 0;
        let vendorMaxScore = 0;
        
        hierarchyReqs.forEach((req) => {
          const hierarchyWeight = getHierarchyWeight(req);
          if (hierarchyWeight === 0) return;
          
          const typeWeight = TYPE_WEIGHTS[req.requirementType];
          const requirementMaxScore = typeWeight * MAX_SCORE * hierarchyWeight;
          vendorMaxScore += requirementMaxScore;
          
          const vendorData = req.vendorData.find((v) => v.vendorId === vendor.id);
          if (vendorData && vendorData.scores.length > 0) {
            const avgScore =
              vendorData.average !== null && vendorData.average !== undefined
                ? vendorData.average
                : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
            vendorActualScore += avgScore * typeWeight * hierarchyWeight;
          }
        });
        
        const score = vendorMaxScore > 0 ? (vendorActualScore / vendorMaxScore) * 100 : 0;
        // Use hierarchy ID as the key
        entry[level1.id] = score;
      });
      
      return entry;
    });
    
    return data;
  }, [filteredRequirements, filteredVendors, hierarchyGroups, showVendorNames, vendorShortNames, vendorAnonymizedMap, getHierarchyWeight]);

  // Calculate grouped chart data for level 2 hierarchies when a level 1 is selected
  const level2GroupedChartData = useMemo(() => {
    if (hierarchyViewMode !== "specific" || !selectedHierarchyId) {
      return null;
    }

    // Find the selected hierarchy
    const selectedHierarchy = hierarchyGroups.find(l1 => l1.id === selectedHierarchyId);
    if (!selectedHierarchy || selectedHierarchy.children.length === 0) {
      return null; // Not a level 1 hierarchy or has no children
    }

    const sortedVendors = [...filteredVendors].sort((a, b) => a.id.localeCompare(b.id));
    
    // Create data structure: one entry per vendor with scores for each level 2 hierarchy
    const data = sortedVendors.map((vendor) => {
      const vendorLabel = showVendorNames
        ? vendorShortNames.get(vendor.id) || vendor.name
        : vendorAnonymizedMap.get(vendor.id) || `V${sortedVendors.indexOf(vendor) + 1}`;
      
      const entry: Record<string, string | number> = { name: vendorLabel };
      
      // Calculate score for each level 2 hierarchy
      selectedHierarchy.children.forEach((level2) => {
        const hierarchyReqs = filteredRequirements.filter(
          (req) => req.hierarchy.id === level2.id
        );
        
        // Calculate score for this vendor in this hierarchy
        let vendorActualScore = 0;
        let vendorMaxScore = 0;
        
        hierarchyReqs.forEach((req) => {
          const hierarchyWeight = getHierarchyWeight(req);
          if (hierarchyWeight === 0) return;
          
          const typeWeight = TYPE_WEIGHTS[req.requirementType];
          const requirementMaxScore = typeWeight * MAX_SCORE * hierarchyWeight;
          vendorMaxScore += requirementMaxScore;
          
          const vendorData = req.vendorData.find((v) => v.vendorId === vendor.id);
          if (vendorData && vendorData.scores.length > 0) {
            const avgScore =
              vendorData.average !== null && vendorData.average !== undefined
                ? vendorData.average
                : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
            vendorActualScore += avgScore * typeWeight * hierarchyWeight;
          }
        });
        
        const score = vendorMaxScore > 0 ? (vendorActualScore / vendorMaxScore) * 100 : 0;
        // Use hierarchy ID as the key
        entry[level2.id] = score;
      });
      
      return entry;
    });
    
    return { data, level1Hierarchy: selectedHierarchy };
  }, [filteredRequirements, filteredVendors, hierarchyGroups, showVendorNames, vendorShortNames, vendorAnonymizedMap, getHierarchyWeight, hierarchyViewMode, selectedHierarchyId]);

  // Handle weight editing
  const handleWeightClick = (hierarchyId: string, currentWeight: number) => {
    setEditingWeights(new Map(editingWeights.set(hierarchyId, currentWeight.toString())));
    setTimeout(() => {
      weightInputRefs.current.get(hierarchyId)?.focus();
      weightInputRefs.current.get(hierarchyId)?.select();
    }, 0);
  };

  const handleWeightChange = (hierarchyId: string, value: string) => {
    setEditingWeights(new Map(editingWeights.set(hierarchyId, value)));
  };

  const handleWeightBlur = async (hierarchyId: string, level1HierarchyId: string | null) => {
    const inputValue = editingWeights.get(hierarchyId);
    if (inputValue === undefined) return;

    // Parse as integer (0-9 only)
    const parsedValue = parseInt(inputValue, 10);
    if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 9 || !Number.isInteger(parseFloat(inputValue))) {
      // Reset to original value
      const originalWeight = hierarchyWeights.find((w) => w.hierarchyId === hierarchyId);
      const group = hierarchyGroups
        .flatMap((l1) => [l1, ...l1.children])
        .find((g) => g.id === hierarchyId);
      
      const originalValue = originalWeight ? parseFloat(originalWeight.weight) : (group?.weight ?? 1);
      setEditingWeights(new Map(editingWeights.set(hierarchyId, originalValue.toString())));
      return;
    }
    
    const newWeight = parsedValue; // Now we know it's a valid integer 0-9

    setSavingWeights(new Set(savingWeights).add(hierarchyId));

    try {
      // Build weights array from hierarchyGroups to ensure all hierarchies are included
      // Create a map of existing weights for quick lookup
      const existingWeightMap = new Map<string, { weight: number; level1HierarchyId: string | null }>();
      hierarchyWeights.forEach((w) => {
        existingWeightMap.set(w.hierarchyId, {
          weight: parseFloat(w.weight),
          level1HierarchyId: w.level1HierarchyId,
        });
      });

      // Build weights from hierarchyGroups, applying the update and preserving existing weights
      const weightsToUpdate = hierarchyGroups.flatMap((level1) => {
        // Determine level 1 weight: use newWeight if this is the hierarchy being updated, otherwise use existing or current
        const level1Weight = level1.id === hierarchyId 
          ? newWeight 
          : (existingWeightMap.get(level1.id)?.weight ?? level1.weight);
        
        const result: Array<{ hierarchyId: string; level1HierarchyId: string | null; weight: number }> = [
          {
            hierarchyId: level1.id,
            level1HierarchyId: null,
            weight: level1Weight,
          },
        ];
        
        // Add level 2 weights
        level1.children.forEach((level2) => {
          const level2Weight = level2.id === hierarchyId
            ? newWeight
            : (existingWeightMap.get(level2.id)?.weight ?? level2.weight);
          
          result.push({
            hierarchyId: level2.id,
            level1HierarchyId: level1.id,
            weight: level2Weight,
          });
        });
        
        return result;
      });

      const updated = await api.evaluation.hierarchyWeights.update(projectId, {
        weights: weightsToUpdate,
      });

      setHierarchyWeights(updated);
      editingWeights.delete(hierarchyId);
      setEditingWeights(new Map(editingWeights));
      
      // Reload comparison data to reflect updated weights in visualizations
      api.evaluation
        .comparison(projectId, filters)
        .then(setComparison)
        .catch((err) => {
          console.error("Failed to reload comparison data after weight update:", err);
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update weight");
    } finally {
      setSavingWeights((prev) => {
        const next = new Set(prev);
        next.delete(hierarchyId);
        return next;
      });
    }
  };

  // Get all hierarchy IDs that should be excluded (weight 0 and their children)
  const getExcludedHierarchyIds = useMemo(() => {
    const excluded = new Set<string>();
    hierarchyGroups.forEach((level1) => {
      if (level1.weight === 0) {
        excluded.add(level1.id);
        level1.children.forEach((level2) => {
          excluded.add(level2.id);
        });
      } else {
        level1.children.forEach((level2) => {
          if (level2.weight === 0) {
            excluded.add(level2.id);
          }
        });
      }
    });
    return excluded;
  }, [hierarchyGroups]);

  // Calculate statistics for a requirement
  const calculateStats = (req: EvaluationComparison) => {
    const allScores = req.vendorData.flatMap((v) => v.scores);
    if (allScores.length === 0) {
      return { average: null, stdDev: null };
    }

    const average = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const variance =
      allScores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / allScores.length;
    const stdDev = Math.sqrt(variance);

    return { average, stdDev };
  };

  // Toggle hierarchy expansion
  const toggleHierarchy = (hierarchyId: string) => {
    setExpandedHierarchies((prev) => {
      const next = new Set(prev);
      if (next.has(hierarchyId)) {
        next.delete(hierarchyId);
      } else {
        next.add(hierarchyId);
      }
      return next;
    });
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">Compare Evaluations</h2>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setWeightsModalOpen(true)}
            className="px-4 py-2 border border-border-primary rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2 bg-background-secondary text-text-primary hover:bg-background-tertiary cursor-pointer"
          >
            <Scale className="h-4 w-4" />
            Weights
          </button>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showVendorNames}
              onChange={(e) => setShowVendorNames(e.target.checked)}
              className="rounded"
            />
            Show Names
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder="Search requirements..."
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`px-4 py-2 border border-border-primary rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2 cursor-pointer ${
                ((filters.evaluatorIds && filters.evaluatorIds.length > 0) || 
                 (filters.vendorIds && filters.vendorIds.length > 0) ||
                 (filters.requirementFilter && filters.requirementFilter !== "all"))
                  ? "bg-accent-600 text-white hover:bg-accent-700"
                  : "bg-background-secondary text-text-primary hover:bg-background-tertiary"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {((filters.evaluatorIds && filters.evaluatorIds.length > 0) || 
                (filters.vendorIds && filters.vendorIds.length > 0) ||
                (filters.requirementFilter && filters.requirementFilter !== "all")) && (
                <span className="px-1.5 py-0.5 bg-white text-black text-xs rounded-full font-semibold">
                  {(filters.evaluatorIds?.length || 0) +
                   (filters.vendorIds?.length || 0) +
                   (filters.requirementFilter && filters.requirementFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary">Evaluators</div>
            <DropdownMenuCheckboxItem
              checked={!filters.evaluatorIds || filters.evaluatorIds.length === 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.evaluatorIds;
                    return next;
                  });
                }
              }}
              onSelect={(e) => e.preventDefault()}
            >
              All evaluators
            </DropdownMenuCheckboxItem>
            {projectMembers
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((member, index) => {
                const displayName = showVendorNames
                  ? (member.firstName && member.lastName
                      ? `${member.firstName} ${member.lastName}`
                      : member.name || member.email)
                  : `Evaluator ${index + 1}`;
                
                return (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={filters.evaluatorIds?.includes(member.id) || false}
                    onCheckedChange={(checked) => {
                      setFilters((prev) => {
                        const currentEvaluatorIds = prev.evaluatorIds || [];
                        if (checked) {
                          // Add evaluator if not already in the list
                          if (!currentEvaluatorIds.includes(member.id)) {
                            return {
                              ...prev,
                              evaluatorIds: [...currentEvaluatorIds, member.id],
                            };
                          }
                        } else {
                          // Remove evaluator from the list
                          return {
                            ...prev,
                            evaluatorIds: currentEvaluatorIds.filter((id) => id !== member.id),
                          };
                        }
                        return prev;
                      });
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {displayName}
                  </DropdownMenuCheckboxItem>
                );
              })}
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary mt-2">Vendors</div>
            <DropdownMenuCheckboxItem
              checked={!filters.vendorIds || filters.vendorIds.length === 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.vendorIds;
                    return next;
                  });
                }
              }}
              onSelect={(e) => e.preventDefault()}
            >
              All vendors
            </DropdownMenuCheckboxItem>
            {vendors.map((vendor) => (
              <DropdownMenuCheckboxItem
                key={vendor.id}
                checked={filters.vendorIds?.includes(vendor.id) || false}
                onCheckedChange={(checked) => {
                  setFilters((prev) => {
                    const currentVendorIds = prev.vendorIds || [];
                    if (checked) {
                      // Add vendor if not already in the list
                      if (!currentVendorIds.includes(vendor.id)) {
                        return {
                          ...prev,
                          vendorIds: [...currentVendorIds, vendor.id],
                        };
                      }
                    } else {
                      // Remove vendor from the list
                      return {
                        ...prev,
                        vendorIds: currentVendorIds.filter((id) => id !== vendor.id),
                      };
                    }
                    return prev;
                  });
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {showVendorNames
                  ? vendorShortNames.get(vendor.id) || vendor.name
                  : vendorAnonymizedMap.get(vendor.id) || `V${vendor.id.slice(0, 8)}`}
                </DropdownMenuCheckboxItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary mt-2">Requirements</div>
            <DropdownMenuCheckboxItem
              checked={!filters.requirementFilter || filters.requirementFilter === "all"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.requirementFilter;
                    return next;
                  });
                }
              }}
              onSelect={(e) => e.preventDefault()}
            >
              All requirements
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.requirementFilter === "withNotes" || filters.requirementFilter === "withNotesAndQuestions"}
              onCheckedChange={(checked) => {
                setFilters((prev) => {
                  const current = prev.requirementFilter || "all";
                  if (checked) {
                    if (current === "withQuestions") {
                      return { ...prev, requirementFilter: "withNotesAndQuestions" };
                    }
                    return { ...prev, requirementFilter: "withNotes" };
                  } else {
                    if (current === "withNotesAndQuestions") {
                      return { ...prev, requirementFilter: "withQuestions" };
                    }
                    if (current === "withNotes") {
                      const next = { ...prev };
                      delete next.requirementFilter;
                      return next;
                    }
                  }
                  return prev;
                });
              }}
              onSelect={(e) => e.preventDefault()}
            >
              With notes
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.requirementFilter === "withQuestions" || filters.requirementFilter === "withNotesAndQuestions"}
              onCheckedChange={(checked) => {
                setFilters((prev) => {
                  const current = prev.requirementFilter || "all";
                  if (checked) {
                    if (current === "withNotes") {
                      return { ...prev, requirementFilter: "withNotesAndQuestions" };
                    }
                    return { ...prev, requirementFilter: "withQuestions" };
                  } else {
                    if (current === "withNotesAndQuestions") {
                      return { ...prev, requirementFilter: "withNotes" };
                    }
                    if (current === "withQuestions") {
                      const next = { ...prev };
                      delete next.requirementFilter;
                      return next;
                    }
                  }
                  return prev;
                });
              }}
              onSelect={(e) => e.preventDefault()}
            >
              With questions
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hierarchy Filter Bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">View:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setHierarchyViewMode("all-combined");
              setSelectedHierarchyId(null);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              hierarchyViewMode === "all-combined"
                ? "bg-accent-600 text-white hover:bg-accent-700"
                : "bg-background-secondary text-text-primary hover:bg-background-tertiary border border-border-primary"
            }`}
          >
            All Combined
          </button>
          <button
            type="button"
            onClick={() => {
              setHierarchyViewMode("all-top-level");
              setSelectedHierarchyId(null);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              hierarchyViewMode === "all-top-level"
                ? "bg-accent-600 text-white hover:bg-accent-700"
                : "bg-background-secondary text-text-primary hover:bg-background-tertiary border border-border-primary"
            }`}
          >
            All Top Level
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
                  hierarchyViewMode === "specific" && selectedHierarchyId
                    ? "bg-accent-600 text-white hover:bg-accent-700"
                    : "bg-background-secondary text-text-primary hover:bg-background-tertiary border border-border-primary"
                }`}
              >
                Specific Hierarchy
                {hierarchyViewMode === "specific" && selectedHierarchyId && (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
              <HierarchySelector
                hierarchyGroups={hierarchyGroups}
                selectedHierarchyId={selectedHierarchyId}
                onSelect={(hierarchyId) => {
                  setHierarchyViewMode("specific");
                  setSelectedHierarchyId(hierarchyId);
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hierarchy Weights Modal */}
      <Dialog open={weightsModalOpen} onOpenChange={setWeightsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hierarchy Weights</DialogTitle>
            <DialogDescription>
              Set weight multipliers for each hierarchy level (0-9). Use 0 to exclude a hierarchy and its children from calculations. Default is 1x for equal importance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {hierarchyGroups.length === 0 ? (
              <div className="text-sm text-text-secondary py-4">
                No hierarchies found. Hierarchies will appear here once requirements are added to the project.
              </div>
            ) : (
              hierarchyGroups.map((level1) => {
                const isExpanded = expandedHierarchies.has(level1.id);
                const isEditing = editingWeights.has(level1.id);
                const currentWeight = isEditing
                  ? editingWeights.get(level1.id) || Math.round(level1.weight).toString()
                  : Math.round(level1.weight).toString();

                return (
                  <div key={level1.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleHierarchy(level1.id)}
                        className="p-1 hover:bg-background-tertiary rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-text-primary flex-1">
                        {level1.number} {level1.title}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            ref={(el) => {
                              if (el) weightInputRefs.current.set(level1.id, el);
                            }}
                            type="number"
                            value={currentWeight}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Only allow digits 0-9
                              if (val === "" || (val.length === 1 && /^[0-9]$/.test(val))) {
                                handleWeightChange(level1.id, val);
                              }
                            }}
                            onBlur={() => handleWeightBlur(level1.id, null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              } else if (e.key === "Escape") {
                                setEditingWeights((prev) => {
                                  const next = new Map(prev);
                                  next.delete(level1.id);
                                  return next;
                                });
                                e.currentTarget.blur();
                              }
                              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                e.preventDefault();
                                e.currentTarget.select();
                              }
                              // Prevent non-digit input
                              if (!/^[0-9]$/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Escape"].includes(e.key) && !(e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                              }
                            }}
                            className="w-16 px-2 py-1 border border-border-primary rounded text-sm text-center"
                            min="0"
                            max="9"
                            disabled={savingWeights.has(level1.id)}
                          />
                          <span className="text-sm text-text-secondary">x</span>
                          {savingWeights.has(level1.id) && (
                            <span className="text-xs text-text-secondary">(saving...)</span>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => handleWeightClick(level1.id, Math.round(level1.weight))}
                          className="px-2 py-1 border border-border-primary rounded text-sm cursor-pointer hover:bg-background-tertiary min-w-[3rem] text-center"
                        >
                          {Math.round(level1.weight)}x
                          {savingWeights.has(level1.id) && " (saving...)"}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="ml-6 space-y-2">
                        {level1.children.map((level2) => {
                          const isEditing2 = editingWeights.has(level2.id);
                          const currentWeight2 = isEditing2
                            ? editingWeights.get(level2.id) || Math.round(level2.weight).toString()
                            : Math.round(level2.weight).toString();

                          return (
                            <div key={level2.id} className="flex items-center gap-2">
                              <span className="text-sm text-text-secondary flex-1">
                                {level2.number} {level2.title}
                              </span>
                              {isEditing2 ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    ref={(el) => {
                                      if (el) weightInputRefs.current.set(level2.id, el);
                                    }}
                                    type="number"
                                    value={currentWeight2}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      // Only allow digits 0-9
                                      if (val === "" || (val.length === 1 && /^[0-9]$/.test(val))) {
                                        handleWeightChange(level2.id, val);
                                      }
                                    }}
                                    onBlur={() => handleWeightBlur(level2.id, level1.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                      } else if (e.key === "Escape") {
                                        setEditingWeights((prev) => {
                                          const next = new Map(prev);
                                          next.delete(level2.id);
                                          return next;
                                        });
                                        e.currentTarget.blur();
                                      }
                                      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                        e.preventDefault();
                                        e.currentTarget.select();
                                      }
                                      // Prevent non-digit input
                                      if (!/^[0-9]$/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Escape"].includes(e.key) && !(e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    className="w-16 px-2 py-1 border border-border-primary rounded text-sm text-center"
                                    min="0"
                                    max="9"
                                    disabled={savingWeights.has(level2.id)}
                                  />
                                  <span className="text-sm text-text-secondary">x</span>
                                  {savingWeights.has(level2.id) && (
                                    <span className="text-xs text-text-secondary">(saving...)</span>
                                  )}
                                </div>
                              ) : (
                                <span
                                  onClick={() => handleWeightClick(level2.id, Math.round(level2.weight))}
                                  className="px-2 py-1 border border-border-primary rounded text-sm cursor-pointer hover:bg-background-tertiary min-w-[3rem] text-center"
                                >
                                  {Math.round(level2.weight)}x
                                  {savingWeights.has(level2.id) && " (saving...)"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bar Graphs */}
      {hierarchyViewMode === "all-top-level" ? (
        <AllTopLevelChart
          groupedChartData={groupedChartData}
          hierarchyGroups={hierarchyGroups}
          hierarchyColors={hierarchyColors}
          formatPercentage={formatPercentage}
        />
      ) : level2GroupedChartData ? (
        <Level2GroupedChart
          data={level2GroupedChartData.data}
          level1Hierarchy={level2GroupedChartData.level1Hierarchy}
          level2HierarchyColors={level2HierarchyColors}
          formatPercentage={formatPercentage}
        />
      ) : (
        <SingleChart
          chartData={chartData}
          title={
            hierarchyViewMode === "specific" && selectedHierarchyId
              ? (() => {
                  const selectedHierarchy = hierarchyGroups
                    .flatMap((l1) => [l1, ...l1.children])
                    .find((h) => h.id === selectedHierarchyId);
                  return selectedHierarchy
                    ? `${selectedHierarchy.number} ${selectedHierarchy.title}`
                    : "Score Comparison";
                })()
              : "Score Comparison"
          }
          vendorColors={vendorColors}
          formatPercentage={formatPercentage}
        />
      )}

      {/* List View Table */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Detailed Scores</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Priority</TableHead>
                  {filteredVendors.map((vendor) => (
                    <TableHead key={vendor.id}>
                      {showVendorNames
                  ? vendorShortNames.get(vendor.id) || vendor.name
                  : vendorAnonymizedMap.get(vendor.id) || `V${vendor.id.slice(0, 8)}`}
                    </TableHead>
                  ))}
                  <TableHead>AVG</TableHead>
                  <TableHead>DEV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHierarchyGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5 + filteredVendors.length} className="text-center text-text-secondary py-8">
                      No hierarchies found. Requirements will appear here once they are added and scored.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHierarchyGroups
                    .filter((level1) => {
                      // Only show level1 if it has requirements after filtering
                      const level1Reqs = filteredRequirements.filter(
                        (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
                      );
                      return level1Reqs.length > 0;
                    })
                    .map((level1) => {
                  const level1Reqs = filteredRequirements.filter(
                    (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
                  );
                  const level1Score = calculateWeightedScore(level1Reqs, level1.id);
                  const isExpanded = expandedHierarchies.has(level1.id);

                  const level1VendorScores = calculateWeightedScorePerVendor(level1Reqs, level1.id);

                  return (
                    <React.Fragment key={level1.id}>
                      {/* Level 1 Header */}
                      <TableRow
                        className="bg-background-tertiary cursor-pointer"
                        onClick={() => toggleHierarchy(level1.id)}
                      >
                        <TableCell colSpan={3} className="font-semibold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {level1.number} {level1.title}
                          </div>
                        </TableCell>
                        {filteredVendors.map((vendor) => {
                          const vendorPercentage = level1VendorScores.get(vendor.id) ?? 0;
                          return (
                            <TableCell key={vendor.id} className="font-semibold">
                              {formatPercentage(vendorPercentage)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-semibold">
                          {formatPercentage(level1Score.percentage)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {isExpanded && (
                        <>
                          {level1.children
                            .filter((level2) => {
                              // Only show level2 if it has requirements after filtering
                              const level2Reqs = filteredRequirements.filter(
                                (req) => req.hierarchy.id === level2.id
                              );
                              return level2Reqs.length > 0;
                            })
                            .map((level2) => {
                            const level2Reqs = filteredRequirements.filter(
                              (req) => req.hierarchy.id === level2.id
                            );
                            const level2Score = calculateWeightedScore(level2Reqs, level2.id);
                            const level2VendorScores = calculateWeightedScorePerVendor(level2Reqs, level2.id);
                            const isLevel2Expanded = expandedHierarchies.has(level2.id);

                            return (
                              <React.Fragment key={level2.id}>
                                {/* Level 2 Header */}
                                <TableRow
                                  className="bg-background-secondary cursor-pointer"
                                  onClick={() => toggleHierarchy(level2.id)}
                                >
                                  <TableCell colSpan={3} className="font-medium pl-8">
                                    <div className="flex items-center gap-2">
                                      {isLevel2Expanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                      {level2.number} {level2.title}
                                    </div>
                                  </TableCell>
                                  {filteredVendors.map((vendor) => {
                                    const vendorPercentage = level2VendorScores.get(vendor.id) ?? 0;
                                    return (
                                      <TableCell key={vendor.id} className="font-medium">
                                        {formatPercentage(vendorPercentage)}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="font-medium">
                                    {formatPercentage(level2Score.percentage)}
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                                {isLevel2Expanded &&
                                  level2Reqs.map((req) => {
                                    const stats = calculateStats(req);
                                    const hasNote = requirementHasNotesOrQuestions(req.requirementId, true, false);
                                    const hasQuestion = requirementHasNotesOrQuestions(req.requirementId, false, true);
                                    return (
                                      <TableRow 
                                        key={req.requirementId}
                                        className="cursor-pointer hover:bg-background-tertiary"
                                        onClick={() => {
                                          const index = requirementsInTableOrder.findIndex(r => r.requirementId === req.requirementId);
                                          setSelectedRequirementId(req.requirementId);
                                          setModalRequirementIndex(index >= 0 ? index : 0);
                                        }}
                                      >
                                        <TableCell>
                                          <div className="flex items-center">
                                            <div className="flex items-center gap-1 w-14 flex-shrink-0">
                                              {hasNote && (
                                                <div 
                                                  className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                                  title="Has note"
                                                >
                                                  n
                                                </div>
                                              )}
                                              {hasQuestion && (
                                                <div 
                                                  className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                                  title="Has question"
                                                >
                                                  q
                                                </div>
                                              )}
                                            </div>
                                            <span>{req.requirementNumber}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>{req.requirementDescription}</TableCell>
                                        <TableCell>
                                          <span
                                            className={`px-2 py-1 rounded text-xs ${
                                              req.requirementType === "Mandatory"
                                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                : req.requirementType === "Important"
                                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                                : req.requirementType === "Wish"
                                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                            }`}
                                          >
                                            {req.requirementType}
                                          </span>
                                        </TableCell>
                                        {filteredVendors.map((vendor) => {
                                          const vendorData = req.vendorData.find(
                                            (v) => v.vendorId === vendor.id
                                          );
                                          const score =
                                            vendorData?.average !== null && vendorData?.average !== undefined
                                              ? vendorData.average
                                              : vendorData?.scores.length
                                              ? vendorData.scores.reduce((a, b) => a + b, 0) /
                                                vendorData.scores.length
                                              : null;
                                          return (
                                            <TableCell key={vendor.id}>
                                              {score !== null ? score.toFixed(1) : "-"}
                                            </TableCell>
                                          );
                                        })}
                                        <TableCell>
                                          {stats.average !== null ? stats.average.toFixed(1) : "-"}
                                        </TableCell>
                                        <TableCell>
                                          {stats.stdDev !== null ? stats.stdDev.toFixed(1) : "-"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                          {/* Requirements directly under level 1 (no level 2) */}
                          {filteredRequirements
                            .filter(
                              (req) =>
                                req.hierarchy.id === level1.id && req.hierarchy.parentId === null
                            )
                            .map((req) => {
                              const stats = calculateStats(req);
                              const hasNote = requirementHasNotesOrQuestions(req.requirementId, true, false);
                              const hasQuestion = requirementHasNotesOrQuestions(req.requirementId, false, true);
                              return (
                                <TableRow 
                                  key={req.requirementId}
                                  className="cursor-pointer hover:bg-background-tertiary"
                                  onClick={() => {
                                    const index = filteredRequirements.findIndex(r => r.requirementId === req.requirementId);
                                    setSelectedRequirementId(req.requirementId);
                                    setModalRequirementIndex(index >= 0 ? index : 0);
                                  }}
                                >
                                  <TableCell>
                                    <div className="flex items-center">
                                      <div className="flex items-center gap-1 w-14 flex-shrink-0">
                                        {hasNote && (
                                          <div 
                                            className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                            title="Has note"
                                          >
                                            n
                                          </div>
                                        )}
                                        {hasQuestion && (
                                          <div 
                                            className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-xs font-semibold"
                                            title="Has question"
                                          >
                                            q
                                          </div>
                                        )}
                                      </div>
                                      <span>{req.requirementNumber}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{req.requirementDescription}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        req.requirementType === "Mandatory"
                                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                          : req.requirementType === "Important"
                                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                          : req.requirementType === "Wish"
                                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                      }`}
                                    >
                                      {req.requirementType}
                                    </span>
                                  </TableCell>
                                  {filteredVendors.map((vendor) => {
                                    const vendorData = req.vendorData.find(
                                      (v) => v.vendorId === vendor.id
                                    );
                                    const score =
                                      vendorData?.average !== null &&
                                      vendorData?.average !== undefined
                                        ? vendorData.average
                                        : vendorData?.scores.length
                                        ? vendorData.scores.reduce((a, b) => a + b, 0) /
                                          vendorData.scores.length
                                        : null;
                                    return (
                                      <TableCell key={vendor.id}>
                                        {score !== null ? score.toFixed(1) : "-"}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell>
                                    {stats.average !== null ? stats.average.toFixed(1) : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {stats.stdDev !== null ? stats.stdDev.toFixed(1) : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </>
                      )}
                    </React.Fragment>
                  );
                }))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Requirement Detail Modal */}
      <Dialog open={selectedRequirementId !== null} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequirementId(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
          {selectedRequirementId && <RequirementDetailModalContent
            projectId={projectId}
            selectedRequirementId={selectedRequirementId}
            modalRequirementIndex={modalRequirementIndex}
            requirementsInTableOrder={requirementsInTableOrder}
            filteredVendors={filteredVendors}
            vendorIdToResponseIdMap={vendorIdToResponseIdMap}
            scores={scores}
            projectMembers={projectMembers}
            showVendorNames={showVendorNames}
            vendorShortNames={vendorShortNames}
            vendorAnonymizedMap={vendorAnonymizedMap}
            setSelectedRequirementId={setSelectedRequirementId}
            setModalRequirementIndex={setModalRequirementIndex}
          />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Requirement Detail Modal Content Component
interface RequirementDetailModalContentProps {
  projectId: string;
  selectedRequirementId: string;
  modalRequirementIndex: number;
  requirementsInTableOrder: EvaluationComparison[];
  filteredVendors: Array<ProjectVendor & { anonymizedId?: string }>;
  vendorIdToResponseIdMap: Map<string, string>;
  scores: Map<string, EvaluationScore>;
  projectMembers: User[];
  showVendorNames: boolean;
  vendorShortNames: Map<string, string>;
  vendorAnonymizedMap: Map<string, string>;
  setSelectedRequirementId: (id: string | null) => void;
  setModalRequirementIndex: (index: number) => void;
}

function RequirementDetailModalContent({
  projectId,
  selectedRequirementId,
  modalRequirementIndex,
  requirementsInTableOrder,
  filteredVendors,
  vendorIdToResponseIdMap,
  scores,
  projectMembers,
  showVendorNames,
  vendorShortNames,
  vendorAnonymizedMap,
  setSelectedRequirementId,
  setModalRequirementIndex,
}: RequirementDetailModalContentProps) {
  const selectedReq = requirementsInTableOrder[modalRequirementIndex];
  const [requirementData, setRequirementData] = useState<EvaluationRequirement | null>(null);
  const [loadingRequirementData, setLoadingRequirementData] = useState(false);
  
  useEffect(() => {
    if (!selectedReq) {
      setSelectedRequirementId(null);
      return;
    }

    // Fetch requirement data with vendor responses when modal opens
    const fetchRequirementData = async () => {
      setLoadingRequirementData(true);
      try {
        const requirements = await api.evaluation.requirements(projectId);
        const requirement = requirements.find(r => r.id === selectedReq.requirementId);
        setRequirementData(requirement || null);
      } catch (error) {
        console.error("Failed to fetch requirement data:", error);
        setRequirementData(null);
      } finally {
        setLoadingRequirementData(false);
      }
    };

    fetchRequirementData();
  }, [selectedReq, projectId, setSelectedRequirementId]);

  if (!selectedReq) {
    return null;
  }

  const currentIndex = modalRequirementIndex;
  const totalRequirements = requirementsInTableOrder.length;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalRequirements - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      const newIndex = currentIndex - 1;
      setModalRequirementIndex(newIndex);
      setSelectedRequirementId(requirementsInTableOrder[newIndex].requirementId);
      setRequirementData(null); // Clear data to trigger fetch for new requirement
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      const newIndex = currentIndex + 1;
      setModalRequirementIndex(newIndex);
      setSelectedRequirementId(requirementsInTableOrder[newIndex].requirementId);
      setRequirementData(null); // Clear data to trigger fetch for new requirement
    }
  };

  // Get evaluator name by ID
  const getEvaluatorName = (evaluatorId: string): string => {
    const evaluator = projectMembers.find(m => m.id === evaluatorId);
    if (!evaluator) return "Unknown";
    if (evaluator.firstName && evaluator.lastName) {
      return `${evaluator.firstName} ${evaluator.lastName}`;
    }
    return evaluator.name || evaluator.email || "Unknown";
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle>
                {selectedReq.requirementNumber}
              </DialogTitle>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  selectedReq.requirementType === "Mandatory"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    : selectedReq.requirementType === "Important"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : selectedReq.requirementType === "Wish"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                }`}
              >
                {selectedReq.requirementType}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-primary">
              {selectedReq.requirementDescription}
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="space-y-6 py-4">
        {filteredVendors.map((vendor) => {
          const vendorData = selectedReq.vendorData.find(v => v.vendorId === vendor.id);
          const vendorResponseId = vendorIdToResponseIdMap.get(vendor.id);
          const scoreKey = vendorResponseId ? `${vendorResponseId}-${selectedReq.requirementId}` : null;

          // Get vendor response data from requirementData
          const vendorResponseData = requirementData?.vendorResponses.find(
            vr => vr.vendor.id === vendor.id
          );

          // Get all scores for this requirement-vendor combination to show all notes/questions
          const allScoresForVendor = Array.from(scores.values()).filter(s => 
            s.requirementId === selectedReq.requirementId && 
            s.vendorResponseId === vendorResponseId
          );

          // Calculate score statistics
          const scoreValues = vendorData?.scores || [];
          const scoreMin = scoreValues.length > 0 ? Math.min(...scoreValues) : null;
          const scoreMax = scoreValues.length > 0 ? Math.max(...scoreValues) : null;
          const scoreAvg = vendorData?.average !== null && vendorData?.average !== undefined
            ? vendorData.average
            : scoreValues.length > 0
            ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
            : null;
          const scoreStdDev = vendorData?.stdDev !== null && vendorData?.stdDev !== undefined
            ? vendorData.stdDev
            : null;

          // Helper function to format score without .0
          const formatScore = (value: number | null): string => {
            if (value === null) return "—";
            const rounded = Math.round(value * 10) / 10;
            if (rounded % 1 === 0) {
              return rounded.toString();
            }
            return rounded.toFixed(1);
          };

          return (
            <Card key={vendor.id} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg text-text-primary">
                  {showVendorNames
                    ? vendorShortNames.get(vendor.id) || vendor.name
                    : vendorAnonymizedMap.get(vendor.id) || `V${vendor.id.slice(0, 8)}`}
                </h4>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-text-secondary font-medium">Min: </span>
                    <span className="text-text-primary">{formatScore(scoreMin)}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary font-medium">Max: </span>
                    <span className="text-text-primary">{formatScore(scoreMax)}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary font-medium">Avg: </span>
                    <span className="text-text-primary">{formatScore(scoreAvg)}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary font-medium">Dev: </span>
                    <span className="text-text-primary">{formatScore(scoreStdDev)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">

                {/* Vendor Response Details */}
                {loadingRequirementData ? (
                  <div className="text-sm text-text-tertiary">Loading vendor response data...</div>
                ) : (
                  <div className="grid grid-cols-12 gap-4 text-sm">
                    <div className="col-span-2 align-top">
                      <div className="text-text-secondary font-medium mb-1 pb-1 border-b border-border-primary">Short Answer</div>
                      <div className="text-text-primary mt-1">
                        {vendorResponseData?.answer || "—"}
                      </div>
                    </div>
                    <div className="col-span-8 align-top">
                      <div className="text-text-secondary font-medium mb-1 pb-1 border-b border-border-primary">Description</div>
                      <div className="text-text-primary whitespace-pre-wrap mt-1">
                        {vendorResponseData?.description || "—"}
                      </div>
                    </div>
                    <div className="col-span-2 align-top">
                      <div className="text-text-secondary font-medium mb-1 pb-1 border-b border-border-primary">Reference</div>
                      <div className="text-text-primary mt-1">
                        {vendorResponseData?.reference || "—"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {allScoresForVendor.some(s => s.note && s.note.trim() !== "") && (
                  <div className="align-top">
                    <div className="text-sm font-medium text-text-secondary pb-1 border-b border-border-primary mb-1">Notes</div>
                    <div className="space-y-0">
                      {allScoresForVendor
                        .filter(s => s.note && s.note.trim() !== "")
                        .map((s, index) => (
                          <div key={s.id}>
                            {index > 0 && (
                              <div className="border-t border-border-primary my-2"></div>
                            )}
                            <div className="py-2 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-text-primary flex-1">{s.note}</div>
                                <div className="text-xs text-text-tertiary whitespace-nowrap">
                                  By {getEvaluatorName(s.evaluatedById)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Questions */}
                {allScoresForVendor.some(s => s.question && s.question.trim() !== "") && (
                  <div className="align-top">
                    <div className="text-sm font-medium text-text-secondary pb-1 border-b border-border-primary mb-1">Questions</div>
                    <div className="space-y-0">
                      {allScoresForVendor
                        .filter(s => s.question && s.question.trim() !== "")
                        .map((s, index) => (
                          <div key={s.id}>
                            {index > 0 && (
                              <div className="border-t border-border-primary my-2"></div>
                            )}
                            <div className="py-2 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-text-primary flex-1">{s.question}</div>
                                <div className="text-xs text-text-tertiary whitespace-nowrap">
                                  By {getEvaluatorName(s.evaluatedById)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 flex items-center justify-between pt-4 px-6 pb-6 border-t border-border-primary">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            canGoPrevious
              ? "bg-background-secondary text-text-primary hover:bg-background-tertiary cursor-pointer"
              : "bg-background-secondary text-text-tertiary cursor-not-allowed opacity-50"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="text-sm text-text-secondary">
          {currentIndex + 1} of {totalRequirements}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            canGoNext
              ? "bg-background-secondary text-text-primary hover:bg-background-tertiary cursor-pointer"
              : "bg-background-secondary text-text-tertiary cursor-not-allowed opacity-50"
          }`}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Keyboard navigation handler - separate useEffect outside modal
function useRequirementModalKeyboard(
  selectedRequirementId: string | null,
  modalRequirementIndex: number,
  requirementsInTableOrder: EvaluationComparison[],
  setSelectedRequirementId: (id: string | null) => void,
  setModalRequirementIndex: (index: number) => void
) {
  useEffect(() => {
    if (selectedRequirementId === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedRequirementId === null) return;
      
      const currentIndex = modalRequirementIndex;
      const totalRequirements = requirementsInTableOrder.length;
      const canGoPrevious = currentIndex > 0;
      const canGoNext = currentIndex < totalRequirements - 1;

      if (e.key === "ArrowLeft" && canGoPrevious) {
        e.preventDefault();
        const newIndex = currentIndex - 1;
        setModalRequirementIndex(newIndex);
        setSelectedRequirementId(requirementsInTableOrder[newIndex].requirementId);
      } else if (e.key === "ArrowRight" && canGoNext) {
        e.preventDefault();
        const newIndex = currentIndex + 1;
        setModalRequirementIndex(newIndex);
        setSelectedRequirementId(requirementsInTableOrder[newIndex].requirementId);
      } else if (e.key === "Escape") {
        setSelectedRequirementId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRequirementId, modalRequirementIndex, requirementsInTableOrder, setSelectedRequirementId, setModalRequirementIndex]);
}
