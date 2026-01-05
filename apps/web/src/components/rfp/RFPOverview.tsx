"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, RFP, ProjectVendor, Project } from "@/lib/api";
import { Card, CardBody, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ContactPersonSelector, ContactPerson, Button } from "@/components/ui";
import { formatISODateTime, formatISODate } from "@/lib/utils";
import { RFPScheduleItem } from "@/lib/api";

interface RFPOverviewProps {
  projectId: string;
  rfp: RFP;
  project?: Project | null;
  onTabChange?: (tab: string) => void;
  onRfpUpdate?: () => void;
}

export default function RFPOverview({ projectId, rfp, project, onTabChange, onRfpUpdate }: RFPOverviewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [_isSavingContact, setIsSavingContact] = useState(false);
  const [_isSavingAlternativeContact, setIsSavingAlternativeContact] = useState(false);
  const [impersonatingContactId, setImpersonatingContactId] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<RFPScheduleItem[]>([]);
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");
  const scheduleLoadingRef = useRef(false);
  const lastScheduleLoadKeyRef = useRef<string>("");
  const initialLoadCompleteRef = useRef(false);

  // Check if user is a project admin for THIS specific project
  // Global Admins are always project admins
  // Company Admins are only project admins if their tenant matches the project's tenant
  const isProjectAdmin =
    user?.role === "GlobalAdministrator" ||
    (user?.role === "CompanyAdministrator" && user?.tenantId === project?.tenantId);

  // Convert project members to ContactPerson format
  const contactOptions: ContactPerson[] = (project?.members || []).map((member) => ({
    id: member.id,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    name: member.name,
  }));

  // Convert RFP contact person to ContactPerson format
  const contactPersonValue: ContactPerson | null = rfp.contactPerson
    ? {
        id: rfp.contactPerson.id,
        email: rfp.contactPerson.email,
        firstName: rfp.contactPerson.firstName,
        lastName: rfp.contactPerson.lastName,
        name: rfp.contactPerson.name,
      }
    : null;

  const alternativeContactPersonValue: ContactPerson | null = rfp.alternativeContactPerson
    ? {
        id: rfp.alternativeContactPerson.id,
        email: rfp.alternativeContactPerson.email,
        firstName: rfp.alternativeContactPerson.firstName,
        lastName: rfp.alternativeContactPerson.lastName,
        name: rfp.alternativeContactPerson.name,
      }
    : null;

  // Load data when projectId changes
  useEffect(() => {
    if (!projectId) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `overview-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    // Reset initial load flag when projectId changes
    initialLoadCompleteRef.current = false;
    lastScheduleLoadKeyRef.current = "";

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    Promise.all([
      api.projects.vendors.list(projectId),
      api.rfp.questions.list(projectId, "unanswered"),
      api.rfp.schedule.list(projectId),
    ])
      .then(([vendorsData, questionsData, scheduleData]) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          // Filter vendors to only show those marked as shallReceiveRFP
          const filteredVendors = vendorsData.filter((pv) => pv.vendor.shallReceiveRFP);
          setVendors(filteredVendors);
          setUnansweredCount(questionsData.length);
          setScheduleItems(scheduleData);
          // Mark initial load as complete and set initial schedule key
          initialLoadCompleteRef.current = true;
          if (rfp) {
            const initialScheduleKey = `schedule-${projectId}-${rfp.publishDate || ""}-${rfp.deliveryDate || ""}`;
            lastScheduleLoadKeyRef.current = initialScheduleKey;
          }
        }
      })
      .catch((err: any) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          console.error("Error loading overview data:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
  }, [projectId]);

  // Reload schedule items when RFP dates change (but not on initial load)
  useEffect(() => {
    if (!projectId || !rfp) return;

    // Create a unique key for this schedule load based on dates
    const scheduleLoadKey = `schedule-${projectId}-${rfp.publishDate || ""}-${rfp.deliveryDate || ""}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (scheduleLoadingRef.current && lastScheduleLoadKeyRef.current === scheduleLoadKey) {
      return;
    }

    // Skip if initial load hasn't completed yet (schedule will be loaded by main effect)
    if (!initialLoadCompleteRef.current) {
      return;
    }

    // Skip if this is the same key as the last load (dates haven't changed)
    if (lastScheduleLoadKeyRef.current === scheduleLoadKey) {
      return;
    }

    scheduleLoadingRef.current = true;
    lastScheduleLoadKeyRef.current = scheduleLoadKey;

    api.rfp.schedule
      .list(projectId)
      .then((scheduleData) => {
        // Only update if this is still the current load
        if (lastScheduleLoadKeyRef.current === scheduleLoadKey) {
          setScheduleItems(scheduleData);
        }
      })
      .catch((err: any) => {
        // Only log error if this is still the current load
        if (lastScheduleLoadKeyRef.current === scheduleLoadKey) {
          console.error("Error loading schedule items:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastScheduleLoadKeyRef.current === scheduleLoadKey) {
          scheduleLoadingRef.current = false;
        }
      });
  }, [projectId, rfp?.publishDate, rfp?.deliveryDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft":
        return "bg-gray-500";
      case "Published":
        return "bg-primary-600";
      case "Closed":
        return "bg-gray-700";
      default:
        return "bg-gray-500";
    }
  };

  const formatVendorStatus = (status: string): string => {
    const statusLabels: Record<string, string> = {
      Pending: "Pending",
      RFI_Received: "RFI Received",
      RFI_Started: "RFI Started",
      RFI_Answered: "RFI Answered",
      RFP_Received: "RFP Received",
      RFP_Delivered: "RFP Delivered",
      RFP_Rejected: "RFP Rejected",
      Shortlisted: "Shortlisted",
      Lost: "Lost",
      Won: "Won",
    };
    return statusLabels[status] || status;
  };

  const getVendorStatusColor = (status: string): "default" | "success" | "warning" | "error" | "info" => {
    switch (status) {
      case "RFP_Delivered":
        return "success"; // Acknowledgement color (green)
      case "RFP_Rejected":
        return "error"; // Error color (red)
      default:
        return "default";
    }
  };


  const handleContactPersonChange = async (person: ContactPerson | null) => {
    setIsSavingContact(true);
    try {
      await api.rfp.update(projectId, {
        contactPersonId: person?.id || null,
      });
      if (onRfpUpdate) {
        onRfpUpdate();
      }
    } catch (err: any) {
      console.error("Error updating contact person:", err);
      alert("Failed to update contact person. Please try again.");
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleAlternativeContactPersonChange = async (person: ContactPerson | null) => {
    setIsSavingAlternativeContact(true);
    try {
      await api.rfp.update(projectId, {
        alternativeContactPersonId: person?.id || null,
      });
      if (onRfpUpdate) {
        onRfpUpdate();
      }
    } catch (err: any) {
      console.error("Error updating alternative contact person:", err);
      alert("Failed to update alternative contact person. Please try again.");
    } finally {
      setIsSavingAlternativeContact(false);
    }
  };

  const handleUnansweredQuestionsClick = () => {
    if (onTabChange) {
      onTabChange("qa");
    }
  };

  const handleDateClick = () => {
    if (onTabChange) {
      onTabChange("schedule");
    }
  };

  const handleImpersonate = async (contactPersonId: string) => {
    if (!isProjectAdmin) return;
    
    try {
      setImpersonatingContactId(contactPersonId);
      
      // Store the current admin token before replacing it
      // Verify we have a token and user is admin before proceeding
      const adminToken = localStorage.getItem("token");
      if (!adminToken) {
        alert("No admin token found. Please log in again.");
        return;
      }
      
      // Verify the token is valid by checking user
      if (!user || (user.role !== "CompanyAdministrator" && user.role !== "GlobalAdministrator")) {
        alert("Invalid admin session. Please log in again.");
        return;
      }
      
      // Save admin token before making the impersonation call
      sessionStorage.setItem('adminToken', adminToken);
      
      const result = await api.rfp.impersonate(projectId, contactPersonId);
      
      // Store the impersonation token in both localStorage and sessionStorage (for reload persistence)
      localStorage.setItem("token", result.token);
      sessionStorage.setItem('impersonationToken', result.token);
      
      // Store projectId and impersonation state in sessionStorage for navigation back and reload persistence
      sessionStorage.setItem('impersonateProjectId', projectId);
      sessionStorage.setItem('isImpersonating', 'true');
      
      // Use router.push for smoother navigation (keeps React state)
      router.push("/portal/rfp?impersonate=true");
    } catch (err: any) {
      console.error("Error impersonating vendor contact:", err);
      // Clean up saved admin token on error
      sessionStorage.removeItem('adminToken');
      alert(err.message || "Failed to impersonate vendor contact. Please try again.");
      setImpersonatingContactId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading overview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <Card className="h-full">
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1">Status</div>
            <Badge className={getStatusColor(rfp.status)}>{rfp.status}</Badge>
          </CardBody>
        </Card>

        <Card
          variant="interactive"
          onClick={handleUnansweredQuestionsClick}
          className="h-full"
        >
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1">Unanswered Questions</div>
            <div className="text-2xl font-bold text-text-primary">
              {unansweredCount}
            </div>
          </CardBody>
        </Card>

        <Card variant="interactive" className="h-full">
          <CardBody>
            <ContactPersonSelector
              value={contactPersonValue}
              options={contactOptions}
              onChange={handleContactPersonChange}
              placeholder="Not set"
              label="Contact Person"
            />
          </CardBody>
        </Card>

        <Card variant="interactive" className="h-full">
          <CardBody>
            <ContactPersonSelector
              value={alternativeContactPersonValue}
              options={contactOptions}
              onChange={handleAlternativeContactPersonChange}
              placeholder="Not set"
              label="Alternative Contact"
            />
          </CardBody>
        </Card>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="interactive" onClick={handleDateClick}>
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1 text-left">Publish date</div>
            <div className="text-text-primary text-left">
              {rfp.publishDate ? (() => {
                const startDateItem = scheduleItems.find((item) => item.type === "StartDate");
                const disregardTimestamp = startDateItem?.disregardTimestamp || false;
                return disregardTimestamp ? formatISODate(rfp.publishDate) : formatISODateTime(rfp.publishDate);
              })() : "Not set"}
            </div>
          </CardBody>
        </Card>

        <Card variant="interactive" onClick={handleDateClick}>
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1 text-left">Deadline for Delivery</div>
            <div className="text-text-primary text-left">
              {rfp.deliveryDate ? (() => {
                const deliveryDateItem = scheduleItems.find((item) => item.type === "DeliveryDate");
                const disregardTimestamp = deliveryDateItem?.disregardTimestamp || false;
                return disregardTimestamp ? formatISODate(rfp.deliveryDate) : formatISODateTime(rfp.deliveryDate);
              })() : "Not set"}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Vendor List */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-semibold mb-4">Vendors</h2>
          {vendors.length === 0 ? (
            <p className="text-text-secondary">Only vendors marked as 'Shall receive RFP' will appear here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Main Contact</TableHead>
                  <TableHead>Last Logged In</TableHead>
                  <TableHead>Status</TableHead>
                  {isProjectAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((pv) => {
                  const mainContact = pv.vendor.contacts?.find((c) => c.isMainContact);
                  const isImpersonating = impersonatingContactId === mainContact?.id;
                  return (
                    <TableRow key={pv.id}>
                      <TableCell className="font-medium">{pv.vendor.name}</TableCell>
                      <TableCell>
                        {mainContact
                          ? `${mainContact.firstName} ${mainContact.lastName}`.trim() || mainContact.email
                          : "No main contact"}
                      </TableCell>
                      <TableCell>
                        {mainContact?.lastLoggedIn
                          ? formatISODateTime(mainContact.lastLoggedIn)
                          : mainContact
                          ? "Never"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getVendorStatusColor(pv.status)}>{formatVendorStatus(pv.status)}</Badge>
                      </TableCell>
                      {isProjectAdmin && (
                        <TableCell>
                          {mainContact ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleImpersonate(mainContact.id)}
                              disabled={isImpersonating}
                            >
                              {isImpersonating ? "Impersonating..." : "Impersonate"}
                            </Button>
                          ) : (
                            <span className="text-text-secondary text-sm">No contact</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

