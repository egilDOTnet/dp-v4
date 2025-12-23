"use client";

import { useEffect, useState } from "react";
import { api, RFP, ProjectVendor, Project } from "@/lib/api";
import { Card, CardBody, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ContactPersonSelector, ContactPerson } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";

interface RFPOverviewProps {
  projectId: string;
  rfp: RFP;
  project?: Project | null;
  onTabChange?: (tab: string) => void;
  onRfpUpdate?: () => void;
}

export default function RFPOverview({ projectId, rfp, project, onTabChange, onRfpUpdate }: RFPOverviewProps) {
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [_isSavingContact, setIsSavingContact] = useState(false);
  const [_isSavingAlternativeContact, setIsSavingAlternativeContact] = useState(false);

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

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vendorsData, questionsData] = await Promise.all([
        api.projects.vendors.list(projectId),
        api.rfp.questions.list(projectId, "unanswered"),
      ]);
      setVendors(vendorsData);
      setUnansweredCount(questionsData.length);
    } catch (err: any) {
      console.error("Error loading overview data:", err);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1">Status</div>
            <Badge className={getStatusColor(rfp.status)}>{rfp.status}</Badge>
          </CardBody>
        </Card>

        <Card
          variant="interactive"
          onClick={handleUnansweredQuestionsClick}
        >
          <CardBody className="min-h-[80px]">
            <div className="text-sm font-medium text-text-primary mb-1 text-left">Unanswered Questions</div>
            <div className="text-2xl font-bold text-text-primary text-center">
              {unansweredCount}
            </div>
          </CardBody>
        </Card>

        <Card variant="interactive">
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

        <Card variant="interactive">
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
              {rfp.publishDate ? formatISODateTime(rfp.publishDate) : "Not set"}
            </div>
          </CardBody>
        </Card>

        <Card variant="interactive" onClick={handleDateClick}>
          <CardBody>
            <div className="text-sm font-medium text-text-primary mb-1 text-left">Deadline for Delivery</div>
            <div className="text-text-primary text-left">
              {rfp.deliveryDate ? formatISODateTime(rfp.deliveryDate) : "Not set"}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Vendor List */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-semibold mb-4">Vendors</h2>
          {vendors.length === 0 ? (
            <p className="text-text-secondary">No vendors added to this project yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Main Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((pv) => {
                  const mainContact = pv.vendor.contacts?.find((c) => c.isMainContact);
                  return (
                    <TableRow key={pv.id}>
                      <TableCell className="font-medium">{pv.vendor.name}</TableCell>
                      <TableCell>
                        {mainContact
                          ? `${mainContact.firstName} ${mainContact.lastName}`.trim() || mainContact.email
                          : "No main contact"}
                      </TableCell>
                      <TableCell>
                        <Badge>{pv.status}</Badge>
                      </TableCell>
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

