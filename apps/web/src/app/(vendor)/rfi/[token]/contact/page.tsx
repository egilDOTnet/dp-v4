"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { RFIHeader } from "@/components/vendor/RFIHeader";

interface VendorContactPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isMainContact: boolean;
}

type ContactAction = "no-change" | "update" | "change-main" | "add-new";

export default function VendorRFIContactPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<{
    vendor: { name: string };
    project: {
      name: string;
      logoData: string | null;
      logoFileType: string | null;
      logoShape: string | null;
      logoPlacement: string | null;
      logoBorder: string | null;
      bannerData: string | null;
      bannerFileType: string | null;
    };
    contactPerson: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    } | null;
  } | null>(null);
  const [contacts, setContacts] = useState<VendorContactPerson[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [action, setAction] = useState<ContactAction>("no-change");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contact, setContact] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null>(null);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    // Load RFI data and existing answers
    Promise.all([
      api.vendor.rfi.getByToken(token),
      api.vendor.rfi.getContacts(token),
      // Load answers from localStorage
      Promise.resolve().then(() => {
        const saved = localStorage.getItem(`rfi-answers-${token}`);
        return saved ? JSON.parse(saved) : {};
      }),
    ])
      .then(([rfiData, contactsData, savedAnswers]) => {
        setData(rfiData);
        setContacts(contactsData);
        setAnswers(savedAnswers);
        const mainContact = rfiData.contactPerson;
        if (mainContact) {
          setContact(mainContact);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load RFI:", err);
        setError(err.message || "Failed to load RFI");
        setLoading(false);
      });
  }, [token]);

  // Update displayed contact when action or selected contact changes
  useEffect(() => {
    if (action === "change-main" && selectedContactId) {
      const selectedContact = contacts.find((c) => c.id === selectedContactId);
      if (selectedContact) {
        setContact({
          firstName: selectedContact.firstName,
          lastName: selectedContact.lastName,
          email: selectedContact.email,
          phone: selectedContact.phone,
        });
      }
    } else if (action === "add-new") {
      if (newContact.firstName || newContact.lastName || newContact.email) {
        setContact({
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          phone: newContact.phone || null,
        });
      }
    } else if (action === "update" && data?.contactPerson) {
      // Keep current contact state for editing, initialize if needed
      if (!contact) {
        setContact(data.contactPerson);
      }
    } else if (action === "no-change" && data?.contactPerson) {
      setContact(data.contactPerson);
    }
  }, [action, selectedContactId, newContact, contacts, data, contact]);

  const handleSubmit = async () => {
    // Validate based on action
    if (action === "update" || action === "add-new") {
      if (!contact || !contact.email || !contact.firstName || !contact.lastName) {
        setError("Please complete all required contact fields");
        return;
      }

      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        setError("Please enter a valid email address");
        return;
      }
    }

    if (action === "change-main" && !selectedContactId) {
      setError("Please select a contact person");
      return;
    }

    if (action === "add-new") {
      if (!newContact.firstName || !newContact.lastName || !newContact.email) {
        setError("Please complete all required fields for the new contact");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email)) {
        setError("Please enter a valid email address");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      // Determine the contact to submit based on action
      let contactToSubmit = contact;
      
      if (action === "add-new") {
        contactToSubmit = {
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          phone: newContact.phone || null,
        };
      } else if (action === "change-main" && selectedContactId) {
        const selectedContact = contacts.find((c) => c.id === selectedContactId);
        if (selectedContact) {
          contactToSubmit = {
            firstName: selectedContact.firstName,
            lastName: selectedContact.lastName,
            email: selectedContact.email,
            phone: selectedContact.phone,
          };
        }
      } else if (action === "update") {
        contactToSubmit = contact;
      } else if (action === "no-change") {
        contactToSubmit = data?.contactPerson || contact;
      }

      if (!contactToSubmit) {
        setError("Contact information is required");
        setSubmitting(false);
        return;
      }

      await api.vendor.rfi.submitResponse(token, {
        answers,
        contactPerson: contactToSubmit,
      });

      // Clear saved answers
      localStorage.removeItem(`rfi-answers-${token}`);

      // Navigate to thank you page
      router.push(`/rfi/${token}/thank-you`);
    } catch (err: any) {
      setError(err.message || "Failed to submit response");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Button
            variant="secondary"
            onClick={() => router.push(`/rfi/${token}`)}
          >
            Back to RFI Information
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const mainContact = data.contactPerson;
  const otherContacts = contacts.filter((c) => !c.isMainContact);
  const hasMultipleContacts = contacts.length > 1;
  const displayedContact = contact || mainContact;

  return (
    <div className="max-w-3xl mx-auto">
      {data && (
        <RFIHeader
          projectName={data.project.name}
          logoData={data.project.logoData}
          logoFileType={data.project.logoFileType}
          logoShape={data.project.logoShape}
          logoPlacement={data.project.logoPlacement}
          logoBorder={data.project.logoBorder}
          bannerData={data.project.bannerData}
          bannerFileType={data.project.bannerFileType}
        />
      )}

      <h2 className="text-2xl font-bold text-text-primary mb-6">
        Confirm Contact Details
      </h2>
      <p className="text-text-secondary mb-6">
        Please confirm or update the contact information for the main contact person for this RFI response.
      </p>

      {/* Display current main contact */}
      {displayedContact && (
        <div className="bg-background-secondary rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Main Contact Person
          </h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-text-secondary">Name: </span>
              <span className="text-text-primary">
                {displayedContact.firstName} {displayedContact.lastName}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-text-secondary">Email: </span>
              <span className="text-text-primary">{displayedContact.email}</span>
            </div>
            {displayedContact.phone && (
              <div>
                <span className="text-sm font-medium text-text-secondary">Phone: </span>
                <span className="text-text-primary">{displayedContact.phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action selection */}
      <div className="bg-background-secondary rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          What would you like to do?
        </h3>
        <div className="space-y-4">
          {/* Option 1: No change needed */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="contact-action"
              value="no-change"
              checked={action === "no-change"}
              onChange={() => setAction("no-change")}
              className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-text-primary">No change needed</span>
          </label>

          {/* Option 2: Update contact details */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="contact-action"
              value="update"
              checked={action === "update"}
              onChange={() => setAction("update")}
              className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-text-primary">Update contact details</span>
          </label>

          {/* Option 3: Change main contact (only if multiple contacts) */}
          {hasMultipleContacts && (
            <div className="space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="contact-action"
                  value="change-main"
                  checked={action === "change-main"}
                  onChange={() => setAction("change-main")}
                  className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <span className="text-text-primary">Change main contact to:</span>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    disabled={action !== "change-main"}
                    className={`ml-3 px-3 py-1.5 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      action !== "change-main" ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="">Select a contact...</option>
                    {otherContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName} ({contact.email})
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          )}

          {/* Option 4: Add new main contact */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="contact-action"
              value="add-new"
              checked={action === "add-new"}
              onChange={() => setAction("add-new")}
              className="mt-1 w-4 h-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-text-primary">Add a new main contact person</span>
          </label>
        </div>
      </div>

      {/* Update contact details form */}
      {action === "update" && displayedContact && (
        <div className="bg-background-secondary rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Update Contact Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={contact?.firstName || ""}
                onChange={(e) =>
                  setContact({ ...contact!, firstName: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={contact?.lastName || ""}
                onChange={(e) =>
                  setContact({ ...contact!, lastName: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={contact?.email || ""}
                onChange={(e) =>
                  setContact({ ...contact!, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={contact?.phone || ""}
                onChange={(e) =>
                  setContact({ ...contact!, phone: e.target.value || null })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add new contact form */}
      {action === "add-new" && (
        <div className="bg-background-secondary rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            New Contact Person Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={newContact.firstName}
                onChange={(e) =>
                  setNewContact({ ...newContact, firstName: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={newContact.lastName}
                onChange={(e) =>
                  setNewContact({ ...newContact, lastName: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={newContact.email}
                onChange={(e) =>
                  setNewContact({ ...newContact, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={newContact.phone}
                onChange={(e) =>
                  setNewContact({ ...newContact, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() => router.push(`/rfi/${token}/questions`)}
        >
          Back to Questions
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
        >
          Submit RFI
        </Button>
      </div>
    </div>
  );
}



