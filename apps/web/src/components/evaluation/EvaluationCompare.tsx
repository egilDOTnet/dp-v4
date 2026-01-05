"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { api, EvaluationComparison, EvaluationHierarchyWeight, User, ProjectVendor } from "@/lib/api";
import { LoadingSpinner, SearchBar, Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

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

export function EvaluationCompare({ projectId }: EvaluationCompareProps) {
  const [comparison, setComparison] = useState<EvaluationComparison[]>([]);
  const [hierarchyWeights, setHierarchyWeights] = useState<EvaluationHierarchyWeight[]>([]);
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
    evaluatorId?: string;
    vendorId?: string;
    hierarchyId?: string;
  }>({});
  const [expandedHierarchies, setExpandedHierarchies] = useState<Set<string>>(new Set());
  const [editingWeights, setEditingWeights] = useState<Map<string, string>>(new Map());
  const [savingWeights, setSavingWeights] = useState<Set<string>>(new Set());
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
    ])
      .then(([comparisonData, weightsData, projectData]) => {
        setComparison(comparisonData);
        setHierarchyWeights(weightsData);
        setProjectMembers(projectData.members || []);
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
  }, [hierarchyWeights]);

  // Calculate weighted scores
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
        if (hierarchyId && req.hierarchy.id !== hierarchyId && req.hierarchy.parent?.id !== hierarchyId) {
          return;
        }

        const typeWeight = TYPE_WEIGHTS[req.requirementType];
        const requirementMaxScore = typeWeight * MAX_SCORE;
        vendorMaxScore += requirementMaxScore;

        const vendorData = req.vendorData.find((v) => v.vendorId === vendorId);
        if (vendorData && vendorData.scores.length > 0) {
          const avgScore =
            vendorData.average !== null && vendorData.average !== undefined
              ? vendorData.average
              : vendorData.scores.reduce((a, b) => a + b, 0) / vendorData.scores.length;
          vendorActualScore += avgScore * typeWeight;
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

  // Filter requirements
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

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((req) =>
        req.requirementDescription.toLowerCase().includes(query) ||
        req.requirementNumber.toLowerCase().includes(query)
      );
    }

    // Hierarchy filter (recursive - includes all children)
    if (filters.hierarchyId) {
      const allowedHierarchyIds = getAllChildHierarchyIds(filters.hierarchyId);
      filtered = filtered.filter(
        (req) =>
          allowedHierarchyIds.has(req.hierarchy.id) ||
          (req.hierarchy.parent && allowedHierarchyIds.has(req.hierarchy.parent.id))
      );
    }

    // Evaluator filter
    if (filters.evaluatorId) {
      // Filter to requirements that have scores from this evaluator
      // Note: This requires checking scores, which we don't have in comparison data
      // For now, we'll skip this filter or implement it via API
    }

    // Vendor filter
    if (filters.vendorId) {
      filtered = filtered.filter((req) =>
        req.vendorData.some((v) => v.vendorId === filters.vendorId)
      );
    }

    return filtered;
  }, [comparison, searchQuery, filters, hierarchyGroups]);

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

  // Prepare chart data
  const chartData = useMemo(() => {
    const data: Array<{
      name: string;
      [key: string]: string | number;
    }> = [];

    // Total score
    const totalScore = calculateWeightedScore(filteredRequirements);
    data.push({
      name: "Total",
      percentage: totalScore.percentage,
    });

    // Level 1 hierarchies
    hierarchyGroups.forEach((level1) => {
      const level1Reqs = filteredRequirements.filter(
        (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
      );
      const level1Score = calculateWeightedScore(level1Reqs, level1.id);
      data.push({
        name: `${level1.number} ${level1.title}`,
        percentage: level1Score.percentage,
      });

      // Level 2 hierarchies
      level1.children.forEach((level2) => {
        const level2Reqs = filteredRequirements.filter(
          (req) => req.hierarchy.id === level2.id
        );
        const level2Score = calculateWeightedScore(level2Reqs, level2.id);
        data.push({
          name: `  ${level2.number} ${level2.title}`,
          percentage: level2Score.percentage,
        });
      });
    });

    return data;
  }, [filteredRequirements, hierarchyGroups]);

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

    const newWeight = parseFloat(inputValue);
    if (isNaN(newWeight) || newWeight < 0) {
      // Reset to original value
      const originalWeight = hierarchyWeights.find((w) => w.hierarchyId === hierarchyId);
      if (originalWeight) {
        setEditingWeights(new Map(editingWeights.set(hierarchyId, originalWeight.weight)));
      } else {
        editingWeights.delete(hierarchyId);
        setEditingWeights(new Map(editingWeights));
      }
      return;
    }

    setSavingWeights(new Set(savingWeights).add(hierarchyId));

    try {
      const weightsToUpdate = hierarchyWeights.map((w) => ({
        hierarchyId: w.hierarchyId,
        level1HierarchyId: w.level1HierarchyId,
        weight: w.hierarchyId === hierarchyId ? newWeight.toString() : w.weight,
      }));

      const updated = await api.evaluation.hierarchyWeights.update(projectId, {
        weights: weightsToUpdate,
      });

      setHierarchyWeights(updated);
      editingWeights.delete(hierarchyId);
      setEditingWeights(new Map(editingWeights));
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

  // Validate level 2 weights sum to level 1 weight
  const validateLevel2Weights = (level1: HierarchyGroup): boolean => {
    const level2Sum = level1.children.reduce((sum, child) => sum + child.weight, 0);
    return Math.abs(level2Sum - level1.weight) < 0.01; // Allow small floating point differences
  };

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
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showVendorNames}
              onChange={(e) => setShowVendorNames(e.target.checked)}
              className="rounded"
            />
            Show vendor names
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
            <Button variant="secondary">
              Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary">Evaluator</div>
            <DropdownMenuCheckboxItem
              checked={!filters.evaluatorId}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.evaluatorId;
                    return next;
                  });
                }
              }}
            >
              All evaluators
            </DropdownMenuCheckboxItem>
            {projectMembers.map((member) => (
              <DropdownMenuCheckboxItem
                key={member.id}
                checked={filters.evaluatorId === member.id}
                onCheckedChange={(checked) => {
                  setFilters((prev) => ({
                    ...prev,
                    evaluatorId: checked ? member.id : undefined,
                  }));
                }}
              >
                {member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.name || member.email}
              </DropdownMenuCheckboxItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary mt-2">Vendor</div>
            <DropdownMenuCheckboxItem
              checked={!filters.vendorId}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.vendorId;
                    return next;
                  });
                }
              }}
            >
              All vendors
            </DropdownMenuCheckboxItem>
            {vendors.map((vendor) => (
              <DropdownMenuCheckboxItem
                key={vendor.id}
                checked={filters.vendorId === vendor.id}
                onCheckedChange={(checked) => {
                  setFilters((prev) => ({
                    ...prev,
                    vendorId: checked ? vendor.id : undefined,
                  }));
                }}
              >
                {showVendorNames
                  ? vendor.name
                  : vendorAnonymizedMap.get(vendor.id) || `V${vendor.id.slice(0, 8)}`}
              </DropdownMenuCheckboxItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-text-secondary mt-2">Hierarchy</div>
            <DropdownMenuCheckboxItem
              checked={!filters.hierarchyId}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next.hierarchyId;
                    return next;
                  });
                }
              }}
            >
              All hierarchies
            </DropdownMenuCheckboxItem>
            {hierarchyGroups.map((level1) => (
              <React.Fragment key={level1.id}>
                <DropdownMenuCheckboxItem
                  checked={filters.hierarchyId === level1.id}
                  onCheckedChange={(checked) => {
                    setFilters((prev) => ({
                      ...prev,
                      hierarchyId: checked ? level1.id : undefined,
                    }));
                  }}
                >
                  {level1.number} {level1.title}
                </DropdownMenuCheckboxItem>
                {level1.children.map((level2) => (
                  <DropdownMenuCheckboxItem
                    key={level2.id}
                    checked={filters.hierarchyId === level2.id}
                    onCheckedChange={(checked) => {
                      setFilters((prev) => ({
                        ...prev,
                        hierarchyId: checked ? level2.id : undefined,
                      }));
                    }}
                    className="pl-8"
                  >
                    {level2.number} {level2.title}
                  </DropdownMenuCheckboxItem>
                ))}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hierarchy Weight Management */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Hierarchy Weights</h3>
          <div className="space-y-4">
            {hierarchyGroups.map((level1) => {
              const isExpanded = expandedHierarchies.has(level1.id);
              const level2Valid = validateLevel2Weights(level1);
              const isEditing = editingWeights.has(level1.id);
              const currentWeight = isEditing
                ? editingWeights.get(level1.id) || level1.weight.toString()
                : level1.weight.toString();

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
                    <span className="text-sm font-medium text-text-primary">
                      {level1.number} {level1.title}
                    </span>
                    {isEditing ? (
                      <input
                        ref={(el) => {
                          if (el) weightInputRefs.current.set(level1.id, el);
                        }}
                        type="number"
                        value={currentWeight}
                        onChange={(e) => handleWeightChange(level1.id, e.target.value)}
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
                        }}
                        className="w-20 px-2 py-1 border border-border-primary rounded text-sm"
                        step="0.01"
                        min="0"
                        disabled={savingWeights.has(level1.id)}
                      />
                    ) : (
                      <span
                        onClick={() => handleWeightClick(level1.id, level1.weight)}
                        className="px-2 py-1 border border-border-primary rounded text-sm cursor-pointer hover:bg-background-tertiary"
                      >
                        {level1.weight.toFixed(2)}%
                        {savingWeights.has(level1.id) && " (saving...)"}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="ml-6 space-y-2">
                      {level1.children.map((level2) => {
                        const isEditing2 = editingWeights.has(level2.id);
                        const currentWeight2 = isEditing2
                          ? editingWeights.get(level2.id) || level2.weight.toString()
                          : level2.weight.toString();

                        return (
                          <div key={level2.id} className="flex items-center gap-2">
                            <span className="text-sm text-text-secondary">
                              {level2.number} {level2.title}
                            </span>
                            {isEditing2 ? (
                              <input
                                ref={(el) => {
                                  if (el) weightInputRefs.current.set(level2.id, el);
                                }}
                                type="number"
                                value={currentWeight2}
                                onChange={(e) => handleWeightChange(level2.id, e.target.value)}
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
                                }}
                                className="w-20 px-2 py-1 border border-border-primary rounded text-sm"
                                step="0.01"
                                min="0"
                                disabled={savingWeights.has(level2.id)}
                              />
                            ) : (
                              <span
                                onClick={() => handleWeightClick(level2.id, level2.weight)}
                                className="px-2 py-1 border border-border-primary rounded text-sm cursor-pointer hover:bg-background-tertiary"
                              >
                                {level2.weight.toFixed(2)}%
                                {savingWeights.has(level2.id) && " (saving...)"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {!level2Valid && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-400">
                          Warning: Level 2 weights sum to{" "}
                          {level1.children.reduce((sum, child) => sum + child.weight, 0).toFixed(2)}%, but
                          level 1 weight is {level1.weight.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Bar Graphs */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Score Comparison</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={200} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]} />
              <Bar dataKey="percentage" fill="#65d405">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#65d405" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

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
                  {vendors.map((vendor) => (
                    <TableHead key={vendor.id}>
                      {showVendorNames
                  ? vendor.name
                  : vendorAnonymizedMap.get(vendor.id) || `V${vendor.id.slice(0, 8)}`}
                    </TableHead>
                  ))}
                  <TableHead>Average</TableHead>
                  <TableHead>Std Dev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchyGroups.map((level1) => {
                  const level1Reqs = filteredRequirements.filter(
                    (req) => req.hierarchy.parent?.id === level1.id || req.hierarchy.id === level1.id
                  );
                  const level1Score = calculateWeightedScore(level1Reqs, level1.id);
                  const isExpanded = expandedHierarchies.has(level1.id);

                  return (
                    <React.Fragment key={level1.id}>
                      {/* Level 1 Header */}
                      <TableRow
                        className="bg-background-tertiary cursor-pointer"
                        onClick={() => toggleHierarchy(level1.id)}
                      >
                        <TableCell colSpan={2} className="font-semibold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {level1.number} {level1.title}
                          </div>
                        </TableCell>
                        <TableCell></TableCell>
                        {vendors.map((vendor) => (
                          <TableCell key={vendor.id}></TableCell>
                        ))}
                        <TableCell className="font-semibold">
                          {level1Score.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {isExpanded && (
                        <>
                          {level1.children.map((level2) => {
                            const level2Reqs = filteredRequirements.filter(
                              (req) => req.hierarchy.id === level2.id
                            );
                            const level2Score = calculateWeightedScore(level2Reqs, level2.id);
                            const isLevel2Expanded = expandedHierarchies.has(level2.id);

                            return (
                              <React.Fragment key={level2.id}>
                                {/* Level 2 Header */}
                                <TableRow
                                  className="bg-background-secondary cursor-pointer"
                                  onClick={() => toggleHierarchy(level2.id)}
                                >
                                  <TableCell colSpan={2} className="font-medium pl-8">
                                    <div className="flex items-center gap-2">
                                      {isLevel2Expanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                      {level2.number} {level2.title}
                                    </div>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  {vendors.map((vendor) => (
                                    <TableCell key={vendor.id}></TableCell>
                                  ))}
                                  <TableCell className="font-medium">
                                    {level2Score.percentage.toFixed(1)}%
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                                {isLevel2Expanded &&
                                  level2Reqs.map((req) => {
                                    const stats = calculateStats(req);
                                    return (
                                      <TableRow key={req.requirementId}>
                                        <TableCell className="pl-12">{req.requirementNumber}</TableCell>
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
                                        {vendors.map((vendor) => {
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
                              return (
                                <TableRow key={req.requirementId}>
                                  <TableCell className="pl-8">{req.requirementNumber}</TableCell>
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
                                  {vendors.map((vendor) => {
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
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
