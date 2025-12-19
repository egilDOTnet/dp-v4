"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, RFPListItem } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function RFPListPage() {
  const router = useRouter();
  const [rfps, setRfps] = useState<RFPListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRFPs();
  }, []);

  const loadRFPs = async () => {
    try {
      const data = await api.vendorRfp.rfps.list();
      setRfps(data);

      // If only one RFP, redirect to detail page
      if (data.length === 1) {
        router.push(`/portal/rfp/${data[0].id}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load RFPs");
      console.error("Failed to load RFPs:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      Sent: "bg-gray-100 text-gray-800",
      Viewed: "bg-blue-100 text-blue-800",
      Participating: "bg-green-100 text-green-800",
      ProposalSubmitted: "bg-purple-100 text-purple-800",
      Declined: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusColors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadRFPs}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rfps.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-text-primary mb-4">No Ongoing RFPs</h2>
        <p className="text-text-secondary">
          You don't have any ongoing RFPs at this time.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-text-primary mb-8">Ongoing RFPs</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rfps.map((rfp) => (
          <Link key={rfp.id} href={`/portal/rfp/${rfp.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardBody>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-text-primary mb-2">
                      {rfp.project.name}
                    </h3>
                    {rfp.vendorResponse && (
                      <div className="mb-2">{getStatusBadge(rfp.vendorResponse.status)}</div>
                    )}
                  </div>
                  {rfp.project.logoData && (
                    <img
                      src={`data:${rfp.project.logoFileType || "image/png"};base64,${rfp.project.logoData}`}
                      alt={`${rfp.project.name} logo`}
                      className="w-16 h-16 object-contain ml-4"
                    />
                  )}
                </div>

                {rfp.about && (
                  <p className="text-sm text-text-secondary mb-4 line-clamp-3">
                    {rfp.about.replace(/<[^>]*>/g, "").substring(0, 150)}
                    {rfp.about.length > 150 ? "..." : ""}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {rfp.scheduleItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-text-secondary">{item.type}:</span>
                      <span className="text-text-primary font-medium">
                        {formatDate(item.date)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border-primary">
                  <span className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View Details →
                  </span>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
