"use client";

import { useEffect, useState } from "react";
import { api, RFP, ProjectVendor } from "@/lib/api";
import { Card, CardBody, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";

interface RFPOverviewProps {
  projectId: string;
  rfp: RFP;
}

export default function RFPOverview({ projectId, rfp }: RFPOverviewProps) {
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);

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


  const getContactName = (contact: RFP["contactPerson"]) => {
    if (!contact) return "Not set";
    if (contact.firstName || contact.lastName) {
      return `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    }
    return contact.name || contact.email || "Unknown";
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
            <div className="text-sm text-text-secondary mb-1">Status</div>
            <Badge className={getStatusColor(rfp.status)}>{rfp.status}</Badge>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Unanswered Questions</div>
            <div className="text-2xl font-bold text-text-primary">{unansweredCount}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Contact Person</div>
            <div className="text-text-primary">{getContactName(rfp.contactPerson)}</div>
            {rfp.contactPerson?.email && (
              <div className="text-sm text-text-secondary">{rfp.contactPerson.email}</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Alternative Contact</div>
            <div className="text-text-primary">
              {rfp.alternativeContactPerson ? getContactName(rfp.alternativeContactPerson) : "Not set"}
            </div>
            {rfp.alternativeContactPerson?.email && (
              <div className="text-sm text-text-secondary">{rfp.alternativeContactPerson.email}</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Publish Date/Time</div>
            <div className="text-text-primary">{rfp.publishDate ? formatISODateTime(rfp.publishDate) : "Not set"}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Delivery Date/Time</div>
            <div className="text-text-primary">{rfp.deliveryDate ? formatISODateTime(rfp.deliveryDate) : "Not set"}</div>
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

