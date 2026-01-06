"use client";

import { useState, useEffect, Fragment } from "react";
import { ProjectVendor, VendorStatus } from "@/lib/api";
import ContactPersonForm from "./ContactPersonForm";
import VendorForm from "./VendorForm";

interface VendorListProps {
  projectId: string;
  vendors: ProjectVendor[];
  onStatusChange: (vendorId: string, status: VendorStatus) => Promise<void>;
  onAddVendor: (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => Promise<void>;
  onUpdateVendor: (
    vendorId: string,
    data: {
      name: string;
      organizationNumber?: string;
      emailDomain?: string;
      additionalData?: any;
      status?: VendorStatus;
    }
  ) => Promise<void>;
  onDeleteVendor: (vendorId: string) => Promise<void>;
  onAddContact: (
    vendorId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => Promise<void>;
  onEditContact: (
    vendorId: string,
    contactId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => Promise<void>;
  onDeleteContact: (vendorId: string, contactId: string) => Promise<void>;
  showAddVendorForm?: boolean;
  onAddVendorFormChange?: (show: boolean) => void;
}

const STATUS_OPTIONS: { value: VendorStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "RFI_Received", label: "RFI Received" },
  { value: "RFI_Rejected", label: "RFI Rejected" },
  { value: "RFI_Answered", label: "RFI Answered" },
  { value: "RFP_Received", label: "RFP Received" },
  { value: "RFP_Answered", label: "RFP Answered" },
  { value: "RFP_Rejected", label: "RFP Rejected" },
  { value: "Shortlisted", label: "Shortlisted" },
  { value: "Lost", label: "Lost" },
  { value: "Won", label: "Won" },
];

export default function VendorList({
  projectId,
  vendors = [],
  onStatusChange,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onAddContact,
  onEditContact,
  onDeleteContact,
  showAddVendorForm = false,
  onAddVendorFormChange,
}: VendorListProps) {
  // Ensure vendors is always an array
  const safeVendors = vendors ?? [];
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [addingContactVendorId, setAddingContactVendorId] = useState<
    string | null
  >(null);
  const [addingVendor, setAddingVendor] = useState(showAddVendorForm);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [isVendorFormAnimating, setIsVendorFormAnimating] = useState(false);
  const [isContactFormAnimating, setIsContactFormAnimating] = useState<
    Record<string, boolean>
  >({});

  // Sync external showAddVendorForm prop and trigger animation
  useEffect(() => {
    if (showAddVendorForm && !addingVendor) {
      if (editingVendorId) {
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`edit-vendor-${editingVendorId}`]: false,
        }));
        setTimeout(() => {
          setEditingVendorId(null);
          setIsContactFormAnimating((prev) => {
            const newState = { ...prev };
            delete newState[`edit-vendor-${editingVendorId}`];
            return newState;
          });
        }, 300);
      }
      setExpandedVendorId(null);
      setEditingContactId(null);
      setAddingContactVendorId(null);
      setAddingVendor(true);
      setIsVendorFormAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVendorFormAnimating(true);
        });
      });
    } else if (!showAddVendorForm && addingVendor) {
      setIsVendorFormAnimating(false);
      setTimeout(() => {
        setAddingVendor(false);
      }, 300);
    }
  }, [showAddVendorForm, addingVendor, editingVendorId]);

  const handleStatusChange = async (vendorId: string, status: VendorStatus) => {
    setUpdatingStatus(vendorId);
    try {
      await onStatusChange(vendorId, status);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteContact = async (vendorId: string, contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }
    try {
      await onDeleteContact(vendorId, contactId);
    } catch (error) {
      // Error handling
    }
  };

  const toggleExpand = (vendorId: string) => {
    if (expandedVendorId === vendorId) {
      setExpandedVendorId(null);
      setEditingContactId(null);
      setAddingContactVendorId(null);
      setEditingVendorId(null);
    } else {
      setExpandedVendorId(vendorId);
      setEditingContactId(null);
      setAddingContactVendorId(null);
      setEditingVendorId(null);
    }
  };

  const handleEditVendorClick = (vendor: ProjectVendor) => {
    if (addingVendor) {
      setIsVendorFormAnimating(false);
      setTimeout(() => {
        setAddingVendor(false);
        if (onAddVendorFormChange) {
          onAddVendorFormChange(false);
        }
        setEditingVendorId(vendor.vendor.id);
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`edit-vendor-${vendor.vendor.id}`]: false,
        }));
        if (expandedVendorId !== vendor.vendor.id) {
          setExpandedVendorId(vendor.vendor.id);
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsContactFormAnimating((prev) => ({
              ...prev,
              [`edit-vendor-${vendor.vendor.id}`]: true,
            }));
          });
        });
      }, 300);
    } else {
      setEditingVendorId(vendor.vendor.id);
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-vendor-${vendor.vendor.id}`]: false,
      }));
      if (expandedVendorId !== vendor.vendor.id) {
        setExpandedVendorId(vendor.vendor.id);
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsContactFormAnimating((prev) => ({
            ...prev,
            [`edit-vendor-${vendor.vendor.id}`]: true,
          }));
        });
      });
    }
  };

  const handleVendorSubmit = async (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => {
    try {
      if (editingVendorId) {
        await onUpdateVendor(editingVendorId, data);
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`edit-vendor-${editingVendorId}`]: false,
        }));
        setTimeout(() => {
          setEditingVendorId(null);
          setIsContactFormAnimating((prev) => {
            const newState = { ...prev };
            delete newState[`edit-vendor-${editingVendorId}`];
            return newState;
          });
        }, 300);
      } else if (addingVendor) {
        await onAddVendor(data);
        setIsVendorFormAnimating(false);
        setTimeout(() => {
          setAddingVendor(false);
          if (onAddVendorFormChange) {
            onAddVendorFormChange(false);
          }
        }, 300);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const handleVendorCancel = () => {
    if (addingVendor) {
      setIsVendorFormAnimating(false);
      setTimeout(() => {
        setAddingVendor(false);
        if (onAddVendorFormChange) {
          onAddVendorFormChange(false);
        }
      }, 300);
    } else if (editingVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-vendor-${editingVendorId}`]: false,
      }));
      setTimeout(() => {
        setEditingVendorId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-vendor-${editingVendorId}`];
          return newState;
        });
      }, 300);
    }
  };

  const handleVendorDelete = async () => {
    if (editingVendorId) {
      await onDeleteVendor(editingVendorId);
      setEditingVendorId(null);
      setExpandedVendorId(null);
    }
  };

  const handleAddContactClick = (vendorId: string) => {
    if (editingContactId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
        setAddingContactVendorId(vendorId);
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`add-${vendorId}`]: false,
        }));
        if (expandedVendorId !== vendorId) {
          setExpandedVendorId(vendorId);
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsContactFormAnimating((prev) => ({
              ...prev,
              [`add-${vendorId}`]: true,
            }));
          });
        });
      }, 300);
    } else {
      setAddingContactVendorId(vendorId);
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${vendorId}`]: false,
      }));
      if (expandedVendorId !== vendorId) {
        setExpandedVendorId(vendorId);
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsContactFormAnimating((prev) => ({
            ...prev,
            [`add-${vendorId}`]: true,
          }));
        });
      });
    }
  };

  const handleEditContactClick = (vendorId: string, contactId: string) => {
    if (addingContactVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${addingContactVendorId}`]: false,
      }));
      setTimeout(() => {
        setAddingContactVendorId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`add-${addingContactVendorId}`];
          return newState;
        });
        setEditingContactId(contactId);
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`edit-${contactId}`]: false,
        }));
        if (expandedVendorId !== vendorId) {
          setExpandedVendorId(vendorId);
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsContactFormAnimating((prev) => ({
              ...prev,
              [`edit-${contactId}`]: true,
            }));
          });
        });
      }, 300);
    } else {
      setEditingContactId(contactId);
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${contactId}`]: false,
      }));
      if (expandedVendorId !== vendorId) {
        setExpandedVendorId(vendorId);
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsContactFormAnimating((prev) => ({
            ...prev,
            [`edit-${contactId}`]: true,
          }));
        });
      });
    }
  };

  const handleContactSubmit = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => {
    if (editingContactId && expandedVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      await onEditContact(expandedVendorId, editingContactId, data);
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
      }, 300);
    } else if (addingContactVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${addingContactVendorId}`]: false,
      }));
      await onAddContact(addingContactVendorId, data);
      setTimeout(() => {
        setAddingContactVendorId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`add-${addingContactVendorId}`];
          return newState;
        });
      }, 300);
    }
  };

  const handleContactCancel = () => {
    if (editingContactId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
      }, 300);
    }
    if (addingContactVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${addingContactVendorId}`]: false,
      }));
      setTimeout(() => {
        setAddingContactVendorId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`add-${addingContactVendorId}`];
          return newState;
        });
      }, 300);
    }
  };

  return (
    <div className="bg-background-secondary rounded-lg shadow-md overflow-hidden border border-border-primary">
      {/* Empty state message */}
      {!addingVendor && safeVendors.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-text-secondary">No vendors added yet</p>
        </div>
      )}

      {safeVendors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-border-primary">
            <thead className="bg-background-tertiary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-[25%]">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-[12%]">
                  Org Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-[15%]">
                  Email Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-[18%]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-[10%]">
                  Contacts
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-[20%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-background-secondary divide-y divide-border-primary">
              {safeVendors.map((projectVendor) => {
                const vendor = projectVendor.vendor;
                const isExpanded = expandedVendorId === vendor.id;
                const contactCount = vendor.contacts?.length || 0;
                const mainContact = vendor.contacts?.find(
                  (c) => c.isMainContact
                );

                return (
                  <Fragment key={projectVendor.id}>
                    <tr className="hover:bg-background-tertiary">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleExpand(vendor.id)}
                            className="mr-2 text-text-tertiary hover:text-text-secondary flex-shrink-0"
                          >
                            {isExpanded ? (
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            )}
                          </button>
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => toggleExpand(vendor.id)}
                          >
                            <div className="text-sm font-medium text-text-primary truncate hover:text-primary-600">
                              {vendor.name}
                            </div>
                            {mainContact && (
                              <div className="text-xs text-text-secondary truncate">
                                Main: {mainContact.firstName}{" "}
                                {mainContact.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        <div className="truncate">
                          {vendor.organizationNumber || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        <div className="truncate">
                          {vendor.emailDomain || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={projectVendor.status}
                          onChange={(e) =>
                            handleStatusChange(
                              vendor.id,
                              e.target.value as VendorStatus
                            )
                          }
                          disabled={updatingStatus === vendor.id}
                          className="w-full text-sm border-border-primary bg-background-secondary text-text-primary rounded-md focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {contactCount}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {editingVendorId !== vendor.id && (
                            <button
                              onClick={() =>
                                handleEditVendorClick(projectVendor)
                              }
                              className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 whitespace-nowrap"
                              title="Edit vendor details"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline Edit Vendor Form */}
                    {editingVendorId === vendor.id && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-4 bg-background-secondary"
                        >
                          <div
                            className={`transition-all duration-300 ease-out ${
                              isContactFormAnimating[`edit-vendor-${vendor.id}`]
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 -translate-y-4"
                            }`}
                          >
                            <VendorForm
                              projectId={projectId}
                              existingVendor={{
                                id: vendor.id,
                                name: vendor.name,
                                organizationNumber: vendor.organizationNumber,
                                emailDomain: vendor.emailDomain,
                              }}
                              onSubmit={handleVendorSubmit}
                              onCancel={handleVendorCancel}
                              onDelete={handleVendorDelete}
                            />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded row showing contacts */}
                    {isExpanded && editingVendorId !== vendor.id && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-4 bg-background-secondary"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm text-text-primary">
                                Contact Persons
                              </h4>
                              {!addingContactVendorId && (
                                <button
                                  onClick={() =>
                                    handleAddContactClick(vendor.id)
                                  }
                                  className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center gap-1"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                  Add Contact
                                </button>
                              )}
                            </div>

                            {/* Inline Add Contact Form */}
                            {addingContactVendorId === vendor.id && (
                              <div
                                className={`mb-3 transition-all duration-300 ease-out ${
                                  isContactFormAnimating[`add-${vendor.id}`]
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 -translate-y-4"
                                }`}
                              >
                                <ContactPersonForm
                                  vendorId={vendor.id}
                                  vendorName={vendor.name}
                                  isFirstContact={
                                    !vendor.contacts ||
                                    vendor.contacts.length === 0
                                  }
                                  onSubmit={handleContactSubmit}
                                  onCancel={handleContactCancel}
                                />
                              </div>
                            )}

                            {/* Inline Edit Contact Form */}
                            {editingContactId &&
                              expandedVendorId === vendor.id &&
                              vendor.contacts && (
                                <>
                                  {vendor.contacts
                                    .filter((c) => c.id === editingContactId)
                                    .map((contact) => (
                                      <div
                                        key={contact.id}
                                        className={`mb-3 transition-all duration-300 ease-out ${
                                          isContactFormAnimating[
                                            `edit-${contact.id}`
                                          ]
                                            ? "opacity-100 translate-y-0"
                                            : "opacity-0 -translate-y-4"
                                        }`}
                                      >
                                        <ContactPersonForm
                                          vendorId={vendor.id}
                                          vendorName={vendor.name}
                                          existingContact={contact}
                                          isFirstContact={false}
                                          onSubmit={handleContactSubmit}
                                          onCancel={handleContactCancel}
                                          onDelete={async () => {
                                            await handleDeleteContact(
                                              vendor.id,
                                              contact.id
                                            );
                                          }}
                                        />
                                      </div>
                                    ))}
                                </>
                              )}

                            {/* Contact List */}
                            {vendor.contacts &&
                              vendor.contacts.length > 0 &&
                              !addingContactVendorId && (
                                <div className="space-y-2">
                                  {vendor.contacts
                                    .filter((c) => c.id !== editingContactId)
                                    .map((contact) => (
                                      <div
                                        key={contact.id}
                                        className="flex items-center justify-between bg-background-tertiary p-3 rounded-md border border-border-primary"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <div className="text-sm font-medium text-text-primary">
                                              {contact.firstName}{" "}
                                              {contact.lastName}
                                            </div>
                                            {contact.isMainContact && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
                                                Main Contact
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-sm text-text-secondary mt-1">
                                            {contact.email}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                          <button
                                            onClick={() =>
                                              handleEditContactClick(
                                                vendor.id,
                                                contact.id
                                              )
                                            }
                                            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline text-sm"
                                          >
                                            Edit
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                            {/* Empty State */}
                            {(!vendor.contacts ||
                              vendor.contacts.length === 0) &&
                              !addingContactVendorId && (
                                <div className="text-center py-4">
                                  <p className="text-sm text-text-secondary italic">
                                    No contacts added yet
                                  </p>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Inline Add Vendor Form - appears after last vendor */}
              {addingVendor && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-4 bg-background-secondary"
                  >
                    <div
                      className={`transition-all duration-300 ease-out ${
                        isVendorFormAnimating
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 -translate-y-4"
                      }`}
                    >
                      <VendorForm
                        projectId={projectId}
                        onSubmit={handleVendorSubmit}
                        onCancel={handleVendorCancel}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
