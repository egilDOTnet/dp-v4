"use client";

import { useEffect, useState, useRef } from "react";
import { api, RFP, RFPScheduleItem } from "@/lib/api";
import { Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";

interface RFPScheduleProps {
  projectId: string;
  rfp: RFP;
  onRfpUpdate?: () => void;
}

export default function RFPSchedule({ projectId, rfp, onRfpUpdate }: RFPScheduleProps) {
  const [items, setItems] = useState<RFPScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, Partial<RFPScheduleItem>>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [disregardTimestamp, setDisregardTimestamp] = useState<Record<string, boolean>>({});
  const [newItemDisregardTimestamp, setNewItemDisregardTimestamp] = useState(false);
  const [newItemData, setNewItemData] = useState({
    description: "",
    date: null as string | null,
    fromDate: null as string | null,
    toDate: null as string | null,
    type: "CustomDate" as RFPScheduleItem["type"],
  });
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");

  useEffect(() => {
    if (!projectId || !rfp) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `schedule-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    api.rfp.schedule
      .list(projectId)
      .then((data) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setItems(data);
        }
      })
      .catch((err: any) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          console.error("Error loading schedule:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
  }, [projectId, rfp]);

  const loadSchedule = async () => {
    // Create a unique key for this load
    const loadKey = `schedule-${projectId}`;
    
    // Prevent duplicate calls
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    try {
      const data = await api.rfp.schedule.list(projectId);
      // Only update if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setItems(data);
      }
    } catch (err: any) {
      // Only log error if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        console.error("Error loading schedule:", err);
      }
    } finally {
      // Only update loading state if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  // Initialize form data for all items when they change
  useEffect(() => {
    items.forEach((item) => {
      if (item && item.id && !formData[item.id]) {
        setFormData((prev) => ({
          ...prev,
          [item.id]: {
            description: item.description,
            date: item.date,
            fromDate: item.fromDate,
            toDate: item.toDate,
          },
        }));
      }
      // Initialize disregardTimestamp from database
      if (item && item.id && disregardTimestamp[item.id] === undefined) {
        setDisregardTimestamp((prev) => ({
          ...prev,
          [item.id]: item.disregardTimestamp || false,
        }));
      }
    });
  }, [items]);


  // Handle clicks outside of editing items to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any item container
      let clickedInsideItem = false;
      Object.values(itemRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideItem = true;
        }
      });

      // Also check if clicking on the create form
      if (isCreatingNew) {
        // Check if clicking on create form (we'll handle this separately)
        const createForm = document.querySelector('[data-create-form="true"]');
        if (createForm && createForm.contains(target)) {
          clickedInsideItem = true;
        }
      }

      if (!clickedInsideItem) {
        // If creating new, handle blur logic
        if (isCreatingNew) {
          handleNewItemBlur();
        }

        // Save any pending changes before exiting edit mode
        Object.entries(editingFields).forEach(([itemId, fields]) => {
          const data = formData[itemId];
          const item = items.find((i) => i.id === itemId);
          
          if (data && item) {
            fields.forEach((field) => {
              if (field === "description" && data.description !== item.description) {
                handleFieldSave(itemId, field, data.description);
              } else if (field === "date" && data.date !== item.date) {
                handleFieldSave(itemId, field, data.date);
              } else if (field === "fromDate" && data.fromDate !== item.fromDate) {
                handleFieldSave(itemId, field, data.fromDate);
              } else if (field === "toDate" && data.toDate !== item.toDate) {
                handleFieldSave(itemId, field, data.toDate);
              }
            });
          }
        });

        // Exit all edit modes
        setEditingFields({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreatingNew, editingFields, formData, items]);

  const handleStartEdit = (item: RFPScheduleItem, field?: string) => {
    // Save any pending changes in other items before entering edit mode
    const otherItemIds = Object.keys(editingFields).filter(id => id !== item.id);
    otherItemIds.forEach((otherItemId) => {
      const otherItem = items.find((i) => i.id === otherItemId);
      const otherData = formData[otherItemId];
      const otherFields = editingFields[otherItemId];
      
      if (otherItem && otherData && otherFields) {
        // Save all changed fields for this item (fire and forget)
        otherFields.forEach((fieldToSave) => {
          if (fieldToSave === "description" && otherData.description !== otherItem.description) {
            handleFieldSave(otherItemId, "description", otherData.description);
          } else if (fieldToSave === "date" && otherData.date !== otherItem.date) {
            handleFieldSave(otherItemId, "date", otherData.date);
          } else if (fieldToSave === "fromDate" && otherData.fromDate !== otherItem.fromDate) {
            handleFieldSave(otherItemId, "fromDate", otherData.fromDate);
          } else if (fieldToSave === "toDate" && otherData.toDate !== otherItem.toDate) {
            handleFieldSave(otherItemId, "toDate", otherData.toDate);
          }
        });
      }
    });

    // Exit edit mode for all other items and enter edit mode for this item
    setEditingFields(() => {
      const newFields: Record<string, Set<string>> = {};
      newFields[item.id] = new Set();
      // If a specific field is provided, only edit that field
      // Otherwise, edit all fields (for backwards compatibility)
      if (field) {
        newFields[item.id].add(field);
      } else {
        newFields[item.id].add("description");
        newFields[item.id].add("date");
        if (item.type === "CustomDateRange") {
          newFields[item.id].add("fromDate");
          newFields[item.id].add("toDate");
        }
      }
      return newFields;
    });
  };

  const handleFieldBlur = (itemId: string, field: string, _e: React.FocusEvent) => {
    const item = items.find((i) => i.id === itemId);
    const data = formData[itemId];
    
    if (item && data) {
      let hasChanged = false;
      if (field === "description" && data.description !== item.description) {
        hasChanged = true;
      } else if (field === "date" && data.date !== item.date) {
        hasChanged = true;
      } else if (field === "fromDate" && data.fromDate !== item.fromDate) {
        hasChanged = true;
      } else if (field === "toDate" && data.toDate !== item.toDate) {
        hasChanged = true;
      }

      if (hasChanged) {
        handleFieldSave(itemId, field, data[field as keyof typeof data]);
      } else {
        // No changes, just exit edit mode for this field
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[itemId]) {
            newFields[itemId].delete(field);
            if (newFields[itemId].size === 0) {
              delete newFields[itemId];
            }
          }
          return newFields;
        });
      }
    }
  };

  const handleFieldSave = async (itemId: string, field: string, value: any) => {
    if (savingFields.has(itemId)) return;
    
    setSavingFields((prev) => new Set(prev).add(itemId));
    
    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      // Convert datetime-local format to ISO string
      const convertToISO = (dateValue: string | null | undefined, stripTime: boolean = false) => {
        if (!dateValue) return null;
        try {
          const date = new Date(dateValue);
          if (stripTime) {
            // Set time to midnight UTC
            date.setUTCHours(0, 0, 0, 0);
          }
          return date.toISOString();
        } catch {
          return null;
        }
      };

      const updatePayload: { description?: string; date?: string | null; fromDate?: string | null; toDate?: string | null } = {};
      if (field === "description") {
        updatePayload.description = value;
      } else if (field === "date") {
        updatePayload.date = convertToISO(value, disregardTimestamp[itemId]);
      } else if (field === "fromDate") {
        // Date ranges always strip time (date-only)
        updatePayload.fromDate = convertToISO(value, true);
      } else if (field === "toDate") {
        // Date ranges always strip time (date-only)
        updatePayload.toDate = convertToISO(value, true);
      }

      await api.rfp.schedule.update(projectId, itemId, updatePayload);
      await loadSchedule();
      
      // Refresh RFP data to update Overview page
      if (onRfpUpdate) {
        onRfpUpdate();
      }

      // Clear editing state for this field
      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[itemId]) {
          newFields[itemId].delete(field);
          if (newFields[itemId].size === 0) {
            delete newFields[itemId];
          }
        }
        return newFields;
      });
    } catch (err: any) {
      console.error("Error saving schedule item:", err);
    } finally {
      setSavingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.isRequired) return;

    if (!confirm(`Are you sure you want to delete "${item.description}"?`)) {
      return;
    }

    try {
      await api.rfp.schedule.delete(projectId, itemId);
      await loadSchedule();
      
      // Refresh RFP data to update Overview page
      if (onRfpUpdate) {
        onRfpUpdate();
      }
    } catch (err: any) {
      console.error("Error deleting schedule item:", err);
    }
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setNewItemData({
      description: "",
      date: null,
      fromDate: null,
      toDate: null,
      type: "CustomDate",
    });
  };

  const handleCancelNew = () => {
    setIsCreatingNew(false);
    setNewItemData({
      description: "",
      date: null,
      fromDate: null,
      toDate: null,
      type: "CustomDate",
    });
    setNewItemDisregardTimestamp(false);
  };

  const handleCreateNew = async () => {
    // Validate before creating
    if (!newItemData.description.trim()) {
      handleCancelNew();
      return;
    }

    try {
      // Convert datetime-local or date format to ISO string
      const convertToISO = (dateValue: string | null | undefined, stripTime: boolean = false) => {
        if (!dateValue || dateValue.trim() === "") return null;
        try {
          let date: Date;
          
          // If it's a date-only string (YYYY-MM-DD), handle it specially
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            // Date-only format - create date at midnight in local timezone, then convert to UTC
            const [year, month, day] = dateValue.split('-').map(Number);
            date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateValue)) {
            // datetime-local format (YYYY-MM-DDTHH:mm)
            date = new Date(dateValue);
          } else {
            // Try parsing as-is (might be ISO string already)
            date = new Date(dateValue);
          }
          
          // Validate the date is valid
          if (isNaN(date.getTime())) {
            console.warn("Invalid date value:", dateValue);
            return null;
          }
          
          if (stripTime) {
            // Set time to midnight UTC
            date.setUTCHours(0, 0, 0, 0);
          }
          
          return date.toISOString();
        } catch (error) {
          console.warn("Error converting date:", dateValue, error);
          return null;
        }
      };

      // Build the payload, only including date fields if they have values
      const convertedDate = convertToISO(newItemData.date, newItemDisregardTimestamp);
      // Date ranges always strip time (date-only)
      const convertedFromDate = convertToISO(newItemData.fromDate, newItemData.type === "CustomDateRange");
      const convertedToDate = convertToISO(newItemData.toDate, newItemData.type === "CustomDateRange");

      const payload: {
        type: RFPScheduleItem["type"];
        description: string;
        date?: string;
        fromDate?: string;
        toDate?: string;
        isRequired?: boolean;
      } = {
        type: newItemData.type,
        description: newItemData.description.trim(),
        isRequired: false,
      };

      if (convertedDate !== null) {
        payload.date = convertedDate;
      }
      if (convertedFromDate !== null) {
        payload.fromDate = convertedFromDate;
      }
      if (convertedToDate !== null) {
        payload.toDate = convertedToDate;
      }

      await api.rfp.schedule.create(projectId, payload);
      setIsCreatingNew(false);
      setNewItemData({
        description: "",
        date: null,
        fromDate: null,
        toDate: null,
        type: "CustomDate",
      });
      setNewItemDisregardTimestamp(false);
      await loadSchedule();
      
      // Refresh RFP data to update Overview page
      if (onRfpUpdate) {
        onRfpUpdate();
      }
    } catch (err: any) {
      console.error("Error adding schedule item:", err);
      // Re-throw to show error to user
      throw err;
    }
  };

  const handleNewItemBlur = () => {
    // Small delay to allow for potential click events on other elements
    setTimeout(() => {
      // Check if focus moved to another element within the form
      const activeElement = document.activeElement;
      const createForm = document.querySelector('[data-create-form="true"]');
      if (createForm && activeElement && createForm.contains(activeElement)) {
        // Focus is still within the form, don't cancel
        return;
      }

      const hasContent = newItemData.description.trim() || 
        newItemData.date !== null ||
        newItemData.fromDate !== null ||
        newItemData.toDate !== null;
      
      if (hasContent) {
        handleCreateNew();
      } else {
        handleCancelNew();
      }
    }, 150);
  };

  const handleQuestionsLinkToggle = async () => {
    const questionsItem = items.find((i) => i.type === "QuestionsDate");
    const deliveryItem = items.find((i) => i.type === "DeliveryDate");

    if (!questionsItem || !deliveryItem) return;

    const newLinked = !questionsItem.linkedToDeliveryDate;

    if (newLinked && deliveryItem.date) {
      // Link to delivery date - update the Questions date to match delivery date
      // Also sync the disregardTimestamp setting from delivery item
      await api.rfp.schedule.update(projectId, questionsItem.id, {
        date: deliveryItem.date,
        linkedToDeliveryDate: true,
        disregardTimestamp: deliveryItem.disregardTimestamp,
      });
    } else {
      // Unlinking - preserve the current date (or use delivery date if currently linked)
      const dateToUse = questionsItem.date || (deliveryItem.date ? deliveryItem.date : null);
      if (dateToUse) {
        await api.rfp.schedule.update(projectId, questionsItem.id, {
          date: dateToUse,
          linkedToDeliveryDate: false,
        });
      } else {
        // Just update the link flag
        await api.rfp.schedule.update(projectId, questionsItem.id, {
          linkedToDeliveryDate: false,
        });
      }
    }
    
    // Reload schedule to get latest data
    await loadSchedule();
    
    // Refresh RFP data to update Overview page
    if (onRfpUpdate) {
      onRfpUpdate();
    }
    
    // Initialize formData for the updated item
    const updatedData = await api.rfp.schedule.list(projectId);
    const updatedQuestionsItem = updatedData.find((item) => item.type === "QuestionsDate");
    const updatedDeliveryItem = updatedData.find((item) => item.type === "DeliveryDate");
    if (updatedQuestionsItem) {
      setFormData((prev) => ({
        ...prev,
        [updatedQuestionsItem.id]: {
          description: updatedQuestionsItem.description,
          date: updatedQuestionsItem.date,
          fromDate: updatedQuestionsItem.fromDate,
          toDate: updatedQuestionsItem.toDate,
        },
      }));
      // Update disregardTimestamp state if linked
      if (updatedQuestionsItem.linkedToDeliveryDate && updatedDeliveryItem) {
        setDisregardTimestamp((prev) => ({
          ...prev,
          [updatedQuestionsItem.id]: updatedDeliveryItem.disregardTimestamp,
        }));
      }
    }
  };

  const formatDateTime = (dateString: string | null, dateOnly: boolean = false) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      if (dateOnly) {
        return `${year}-${month}-${day}`;
      }
      // Convert to local time for datetime-local input
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const displayDateTime = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return formatISODateTime(dateString);
  };

  // Get day number from date (for calendar display)
  const getDayNumber = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.getDate();
    } catch {
      return null;
    }
  };

  // Get time string from date
  const getTimeString = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return null;
    }
  };

  // Get month name from date
  const getMonthName = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'long' });
    } catch {
      return null;
    }
  };

  // Get month key for grouping (YYYY-MM)
  const getMonthKey = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading schedule...</p>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.date || a.fromDate;
    const dateB = b.date || b.fromDate;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  // Group items by month
  const itemsByMonth = new Map<string, RFPScheduleItem[]>();
  const itemsWithoutDate: RFPScheduleItem[] = [];
  
  sortedItems.forEach((item) => {
    const date = item.date || item.fromDate;
    const monthKey = getMonthKey(date);
    if (monthKey) {
      if (!itemsByMonth.has(monthKey)) {
        itemsByMonth.set(monthKey, []);
      }
      itemsByMonth.get(monthKey)!.push(item);
    } else {
      // Items without dates go to a special section
      itemsWithoutDate.push(item);
    }
  });

  // Get sorted month keys
  const sortedMonthKeys = Array.from(itemsByMonth.keys()).sort();

  // Render schedule item form (used for both new and edit)
  const renderScheduleItem = (
    item: RFPScheduleItem | null,
    isNew: boolean,
    itemFormData: Partial<RFPScheduleItem>,
    isEditing: boolean
  ) => {
    const isEditingDescription = isEditing && (editingFields[item?.id || ""]?.has("description") || isNew);
    const isEditingDate = isEditing && (editingFields[item?.id || ""]?.has("date") || isNew);
    const isEditingFromDate = isEditing && (editingFields[item?.id || ""]?.has("fromDate") || isNew);
    const isEditingToDate = isEditing && (editingFields[item?.id || ""]?.has("toDate") || isNew);
    const isQuestionsDate = item?.type === "QuestionsDate";
    const deliveryItem = items.find((i) => i.type === "DeliveryDate");
    const itemType = isNew ? newItemData.type : item?.type || "CustomDate";
    const isDateRange = itemType === "CustomDateRange";

    // Get display date for Questions date (show delivery date if linked, otherwise show item date)
    const getDisplayDateForQuestions = () => {
      if (isQuestionsDate && item?.linkedToDeliveryDate && deliveryItem?.date) {
        return deliveryItem.date;
      }
      return itemFormData.date || item?.date || null;
    };

    // Get day number for calendar display
    const getDisplayDay = () => {
      if (isNew) return "+";
      if (isDateRange && item?.fromDate) {
        return getDayNumber(item.fromDate);
      }
      if (isQuestionsDate) {
        const displayDate = getDisplayDateForQuestions();
        return getDayNumber(displayDate);
      }
      return getDayNumber(itemFormData.date || item?.date || null);
    };

    // Get time string for display below description
    const getDisplayTime = () => {
      // Date ranges never show time
      if (isDateRange) {
        return null;
      }
      // For Questions date when linked, check delivery item's disregardTimestamp setting
      if (isQuestionsDate && item?.linkedToDeliveryDate && deliveryItem) {
        // If delivery item has disregardTimestamp, don't show time
        if (deliveryItem.disregardTimestamp) {
          return null;
        }
        const displayDate = getDisplayDateForQuestions();
        return getTimeString(displayDate);
      }
      // Don't show time if timestamp is disregarded
      if (item && disregardTimestamp[item.id]) {
        return null;
      }
      if (isQuestionsDate) {
        const displayDate = getDisplayDateForQuestions();
        return getTimeString(displayDate);
      }
      return getTimeString(itemFormData.date || item?.date || null);
    };

    const displayDay = getDisplayDay();
    const displayTime = getDisplayTime();

    return (
      <div
        className={`
          border-2 border-primary-500 rounded-lg bg-background-tertiary flex items-stretch overflow-hidden
          ${isNew ? "opacity-100" : ""}
        `}
        ref={item ? (el) => { itemRefs.current[item.id] = el; } : undefined}
        data-item-id={item?.id}
        data-create-form={isNew ? "true" : undefined}
      >
        {/* Left side: Green background with day number (calendar style) */}
        {isNew ? (
          <div className="bg-primary-500 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        ) : (
          <div className="bg-primary-500 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
            <span className="font-semibold text-base leading-none">
              {displayDay !== null ? String(displayDay).padStart(2, '0') : '--'}
            </span>
          </div>
        )}

        {/* Right side: Content */}
        <div className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {/* Description with Type toggle (for new items) */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isEditingDescription ? (
                  <input
                    type="text"
                    value={isNew ? newItemData.description : (itemFormData.description || "")}
                    onChange={(e) => {
                      if (isNew) {
                        setNewItemData({ ...newItemData, description: e.target.value });
                      } else if (item) {
                        setFormData({
                          ...formData,
                          [item.id]: {
                            ...itemFormData,
                            description: e.target.value,
                          },
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle Ctrl-A/Command-A to select all text
                      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                        e.preventDefault();
                        e.currentTarget.select();
                        return;
                      }
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={isNew ? handleNewItemBlur : (e) => handleFieldBlur(item!.id, "description", e)}
                    className="flex-1 px-2 py-1 text-sm font-semibold border border-gray-300 rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter description"
                    autoFocus
                  />
                ) : (
                  <div className="flex-1">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isNew && item) {
                          // Enter edit mode for both description and date
                          handleStartEdit(item);
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              const input = itemRefs.current[item.id]?.querySelector('input[type="text"]') as HTMLInputElement;
                              input?.focus();
                              input?.select();
                            }, 0);
                          });
                        }
                      }}
                      className="text-sm font-semibold text-text-primary cursor-text hover:bg-background-secondary px-2 py-1 rounded -mx-2 -my-1"
                    >
                      {itemFormData.description || (isNew ? "Enter description" : "")}
                    </div>
                    {/* Show time below description in list mode if timestamp exists and not disregarded */}
                    {!isNew && !isEditing && item && (() => {
                      // For Questions date when linked, check delivery item's disregardTimestamp
                      let shouldShowTime = !disregardTimestamp[item.id] && displayTime;
                      if (isQuestionsDate && item.linkedToDeliveryDate && deliveryItem) {
                        shouldShowTime = !deliveryItem.disregardTimestamp && displayTime;
                      }
                      return shouldShowTime ? (
                        <div className="text-xs text-text-secondary px-2 -mx-2 mt-1">
                          {displayTime}
                        </div>
                      ) : null;
                    })()}
                    {/* Show date range below description in list mode */}
                    {!isNew && !isEditing && item && isDateRange && (() => {
                      const fromDate = itemFormData.fromDate || item?.fromDate;
                      const toDate = itemFormData.toDate || item?.toDate;
                      if (fromDate || toDate) {
                        const formatDateOnly = (dateString: string | null) => {
                          if (!dateString) return 'Not set';
                          try {
                            const date = new Date(dateString);
                            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                          } catch {
                            return 'Not set';
                          }
                        };
                        return (
                          <div className="text-xs text-text-secondary px-2 -mx-2 mt-1">
                            {formatDateOnly(fromDate)} - {formatDateOnly(toDate)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                
                {/* Type toggle (only for new items) */}
                {isNew && (
                  <div className="flex border border-gray-300 rounded-md overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setNewItemData({ ...newItemData, type: "CustomDate" });
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        newItemData.type === "CustomDate"
                          ? "bg-primary-600 text-white"
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                      }`}
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setNewItemData({ ...newItemData, type: "CustomDateRange" });
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        newItemData.type === "CustomDateRange"
                          ? "bg-primary-600 text-white"
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                      }`}
                    >
                      Range
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Date fields - only show in edit mode */}
            {isDateRange ? (
              <>
                {isEditing && (
                  <div className="flex items-start gap-2">
                    <div className="w-1/4">
                      {isEditingFromDate ? (
                        <input
                          type="date"
                          value={formatDateTime(isNew ? newItemData.fromDate : (itemFormData.fromDate || null), true)}
                          onChange={(e) => {
                            const newFromDate = e.target.value || null;
                            if (isNew) {
                              // If toDate is not set, set it to fromDate + 1 week
                              let newToDate = newItemData.toDate;
                              if (newFromDate && !newItemData.toDate) {
                                try {
                                  const fromDate = new Date(newFromDate);
                                  const toDate = new Date(fromDate);
                                  toDate.setDate(toDate.getDate() + 7); // Add 1 week
                                  newToDate = toDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                                } catch {
                                  // Ignore errors
                                }
                              }
                              setNewItemData({ ...newItemData, fromDate: newFromDate, toDate: newToDate });
                            } else if (item) {
                              // If toDate is not set, set it to fromDate + 1 week
                              let newToDate = itemFormData.toDate;
                              if (newFromDate && !itemFormData.toDate) {
                                try {
                                  const fromDate = new Date(newFromDate);
                                  const toDate = new Date(fromDate);
                                  toDate.setDate(toDate.getDate() + 7); // Add 1 week
                                  newToDate = toDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                                } catch {
                                  // Ignore errors
                                }
                              }
                              setFormData({
                                ...formData,
                                [item.id]: {
                                  ...itemFormData,
                                  fromDate: newFromDate,
                                  toDate: newToDate,
                                },
                              });
                            }
                          }}
                          onBlur={isNew ? handleNewItemBlur : (e) => handleFieldBlur(item!.id, "fromDate", e)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="From date"
                        />
                      ) : null}
                    </div>
                    <div className="w-1/4">
                      {isEditingToDate ? (
                        <input
                          type="date"
                          value={formatDateTime(isNew ? newItemData.toDate : (itemFormData.toDate || null), true)}
                          min={formatDateTime(isNew ? newItemData.fromDate : (itemFormData.fromDate || null), true)}
                          onChange={(e) => {
                            if (isNew) {
                              setNewItemData({ ...newItemData, toDate: e.target.value || null });
                            } else if (item) {
                              setFormData({
                                ...formData,
                                [item.id]: {
                                  ...itemFormData,
                                  toDate: e.target.value || null,
                                },
                              });
                            }
                          }}
                          onBlur={isNew ? handleNewItemBlur : (e) => handleFieldBlur(item!.id, "toDate", e)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="To date"
                        />
                      ) : null}
                    </div>
                    {/* Delete button for custom entries */}
                    {!isNew && item && !item.isRequired && (
                      <div className="flex-1 flex justify-end items-start">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={savingFields.has(item.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Date field - only show in edit mode, below the title */}
                {isEditing && (
                  <div className="flex items-start gap-2">
                    <div className="w-1/3 min-w-[300px]">
                      {isEditingDate ? (
                        <>
                          {isQuestionsDate && !isNew && (
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                checked={item?.linkedToDeliveryDate || false}
                                onChange={handleQuestionsLinkToggle}
                                className="rounded"
                              />
                              <label className="text-sm text-text-primary">
                                Link to deadline for delivery
                              </label>
                            </div>
                          )}
                          {/* Hide date input and disregard timestamp checkbox when Questions date is linked to delivery */}
                          {!(isQuestionsDate && !isNew && item?.linkedToDeliveryDate) && (
                            <div className="flex items-center gap-2">
                              <input
                                type={(isNew ? newItemDisregardTimestamp : disregardTimestamp[item?.id || ""]) ? "date" : "datetime-local"}
                                value={formatDateTime(isNew ? newItemData.date : (itemFormData.date || null), isNew ? newItemDisregardTimestamp : disregardTimestamp[item?.id || ""])}
                                onChange={(e) => {
                                  if (isNew) {
                                    setNewItemData({ ...newItemData, date: e.target.value || null });
                                  } else if (item) {
                                    // If Questions date is linked and user changes it, unlink it
                                    if (isQuestionsDate && item?.linkedToDeliveryDate) {
                                      // Update the link flag when user manually changes the date
                                      api.rfp.schedule.update(projectId, item.id, {
                                        linkedToDeliveryDate: false,
                                      }).catch(console.error);
                                    }
                                    setFormData({
                                      ...formData,
                                      [item.id]: {
                                        ...itemFormData,
                                        date: e.target.value || null,
                                      },
                                    });
                                  }
                                }}
                                onBlur={isNew ? handleNewItemBlur : (e) => handleFieldBlur(item!.id, "date", e)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                max={isQuestionsDate && deliveryItem?.date ? formatDateTime(deliveryItem.date) : undefined}
                                className="flex-1 min-w-[180px] px-2 py-1 text-sm border border-gray-300 rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isNew ? newItemDisregardTimestamp : (disregardTimestamp[item?.id || ""] || false)}
                                  onChange={(e) => {
                                    if (isNew) {
                                      setNewItemDisregardTimestamp(e.target.checked);
                                      // If checking "disregard timestamp", strip time from the date
                                      if (e.target.checked && newItemData.date) {
                                        try {
                                          const dateObj = new Date(newItemData.date);
                                          const year = dateObj.getFullYear();
                                          const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                                          const day = String(dateObj.getDate()).padStart(2, "0");
                                          const dateOnly = `${year}-${month}-${day}`;
                                          setNewItemData({ ...newItemData, date: dateOnly });
                                        } catch {
                                          // Ignore errors
                                        }
                                      }
                                    } else if (item) {
                                      const newDisregardTimestamp = e.target.checked;
                                      setDisregardTimestamp((prev) => ({
                                        ...prev,
                                        [item.id]: newDisregardTimestamp,
                                      }));
                                      
                                      // Save the preference to database
                                      api.rfp.schedule.update(projectId, item.id, {
                                        disregardTimestamp: newDisregardTimestamp,
                                      }).catch(console.error);
                                      
                                      // If checking "disregard timestamp", strip time from the date
                                      if (newDisregardTimestamp && itemFormData.date) {
                                        try {
                                          const dateObj = new Date(itemFormData.date);
                                          const year = dateObj.getFullYear();
                                          const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                                          const day = String(dateObj.getDate()).padStart(2, "0");
                                          const dateOnly = `${year}-${month}-${day}`;
                                          setFormData({
                                            ...formData,
                                            [item.id]: {
                                              ...itemFormData,
                                              date: dateOnly,
                                            },
                                          });
                                        } catch {
                                          // Ignore errors
                                        }
                                      }
                                    }
                                  }}
                                  className="rounded"
                                />
                                <label className="text-xs text-text-primary whitespace-nowrap">
                                  Disregard timestamp
                                </label>
                              </div>
                            </div>
                          )}
                          {isQuestionsDate && deliveryItem?.date && !isNew && (
                            <p className="text-xs text-text-secondary mt-1">
                              Must be before deadline for delivery: {displayDateTime(deliveryItem.date)}
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>
                    {/* Delete button for custom entries */}
                    {!isNew && item && !item.isRequired && (
                      <div className="flex-1 flex justify-end items-start">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={savingFields.has(item.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-text-primary">Schedule</h2>
            {!isCreatingNew && (
              <Button onClick={handleStartNew} variant="primary">
                + New Date
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {sortedItems.length === 0 && !isCreatingNew ? (
            <EmptyState
              title="No schedule items yet"
              description="Add schedule items to define important dates and deadlines for the RFP process."
              action={{
                label: "+ New Date",
                onClick: handleStartNew,
              }}
            />
          ) : (
            <div className="space-y-2">
              {/* New item form */}
              {isCreatingNew && renderScheduleItem(
                null,
                true,
                { description: newItemData.description, date: newItemData.date, fromDate: newItemData.fromDate, toDate: newItemData.toDate },
                true
              )}

              {/* Month dividers and items */}
              {sortedMonthKeys.map((monthKey) => {
                const monthItems = itemsByMonth.get(monthKey) || [];
                const firstItem = monthItems[0];
                const monthName = getMonthName(firstItem?.date || firstItem?.fromDate || null);

                return (
                  <div key={monthKey} className="space-y-2">
                    {/* Month divider (styled like level 1 hierarchy) */}
                    <div className="rounded-lg bg-primary-700 flex items-stretch overflow-hidden">
                      <div className="flex-1 px-4 py-3">
                        <span className="font-medium text-lg leading-none text-white">
                          {monthName || 'Unknown Month'}
                        </span>
                      </div>
                    </div>

                    {/* Items for this month (styled like level 2 requirements) */}
                    <div className="ml-[8.333%] space-y-2">
                      {monthItems.map((item) => {
                        const isEditing = editingFields[item.id]?.size > 0;
                        const itemFormData = formData[item.id] || {
                          description: item.description,
                          date: item.date,
                          fromDate: item.fromDate,
                          toDate: item.toDate,
                        };

                        return (
                          <div key={item.id}>
                            {renderScheduleItem(
                              item,
                              false,
                              itemFormData,
                              isEditing
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Items without dates */}
              {itemsWithoutDate.length > 0 && (
                <div className="space-y-2">
                  {/* Month divider for items without dates */}
                  <div className="rounded-lg bg-primary-700 flex items-stretch overflow-hidden">
                    <div className="flex-1 px-4 py-3">
                      <span className="font-medium text-lg leading-none text-white">
                        No Date Set
                      </span>
                    </div>
                  </div>

                  {/* Items without dates */}
                  <div className="ml-[8.333%] space-y-2">
                    {itemsWithoutDate.map((item) => {
                      const isEditing = editingFields[item.id]?.size > 0;
                      const itemFormData = formData[item.id] || {
                        description: item.description,
                        date: item.date,
                        fromDate: item.fromDate,
                        toDate: item.toDate,
                      };

                      return (
                        <div key={item.id}>
                          {renderScheduleItem(
                            item,
                            false,
                            itemFormData,
                            isEditing
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

