"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface VendorContactPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isMainContact: boolean;
}

interface VendorContactFormProps {
  token: string;
  initialContact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  vendorName: string;
  onContactChange: (contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  }) => void;
}

export function VendorContactForm({
  token,
  initialContact,
  vendorName,
  onContactChange,
}: VendorContactFormProps) {
  const [contacts, setContacts] = useState<VendorContactPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string>("new");
  const [isNewContact, setIsNewContact] = useState(!initialContact);
  const [formData, setFormData] = useState({
    firstName: initialContact?.firstName || "",
    lastName: initialContact?.lastName || "",
    email: initialContact?.email || "",
    phone: initialContact?.phone || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadContacts();
  }, [token]);

  useEffect(() => {
    if (selectedContactId && selectedContactId !== "new") {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setFormData({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone || "",
        });
        setIsNewContact(false);
        onContactChange({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
        });
      }
    } else if (selectedContactId === "new") {
      setIsNewContact(true);
    }
  }, [selectedContactId, contacts]);

  useEffect(() => {
    if (isNewContact || formData.email) {
      onContactChange({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
      });
    }
  }, [formData, isNewContact]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await api.vendor.rfi.getContacts(token);
      setContacts(data);
      
      // If initial contact exists, try to find it in the list
      if (initialContact) {
        const existing = data.find((c) => c.email === initialContact.email);
        if (existing) {
          setSelectedContactId(existing.id);
        } else {
          setSelectedContactId("new");
        }
      }
    } catch (error: any) {
      console.error("Failed to load contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Vendor Name
        </label>
        <input
          type="text"
          value={vendorName}
          disabled
          className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-secondary text-text-secondary cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Main Contact Person
        </label>
        {loading ? (
          <div className="text-text-secondary">Loading contacts...</div>
        ) : (
          <select
            value={selectedContactId}
            onChange={(e) => {
              setSelectedContactId(e.target.value);
              setIsNewContact(e.target.value === "new");
            }}
            className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="new">Add new contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName} ({contact.email})
                {contact.isMainContact && " - Main Contact"}
              </option>
            ))}
          </select>
        )}
      </div>

      {(isNewContact || selectedContactId === "new") && (
        <div className="space-y-4 border-t border-border-primary pt-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleFieldChange("firstName", e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
              }}
              className={`w-full px-3 py-2 border rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.firstName ? "border-red-600" : "border-border-primary"
              }`}
            />
            {errors.firstName && (
              <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Last Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleFieldChange("lastName", e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
              }}
              className={`w-full px-3 py-2 border rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.lastName ? "border-red-600" : "border-border-primary"
              }`}
            />
            {errors.lastName && (
              <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
              }}
              className={`w-full px-3 py-2 border rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.email ? "border-red-600" : "border-border-primary"
              }`}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
            <p className="text-text-secondary text-xs mt-1">
              Email address is used as a unique identifier. If changed, a new contact will be created.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
              }}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

