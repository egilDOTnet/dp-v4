"use client";

import { useState, useEffect } from "react";
import { VendorContactPerson } from "@/lib/api";
import ContactPersonForm from "./ContactPersonForm";

interface AddContactsScreenProps {
  vendorId: string;
  vendorName: string;
  existingContacts: VendorContactPerson[];
  onAddContact: (data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => Promise<void>;
  onUpdateContact: (
    contactId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
  onComplete: () => void;
  onSkip: () => void;
}

export default function AddContactsScreen({
  vendorId,
  vendorName,
  existingContacts,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onComplete,
  onSkip,
}: AddContactsScreenProps) {
  const [contacts, setContacts] = useState<
    Array<{
      id?: string;
      firstName: string;
      lastName: string;
      email: string;
      isMainContact: boolean;
      isNew?: boolean;
    }>
  >(
    existingContacts.length > 0
      ? existingContacts.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          isMainContact: c.isMainContact,
          isNew: false,
        }))
      : [
          {
            firstName: "",
            lastName: "",
            email: "",
            isMainContact: true,
            isNew: true,
          },
        ]
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync contacts when existingContacts prop changes (after API calls)
  useEffect(() => {
    if (existingContacts.length > 0) {
      const savedContacts = existingContacts.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        isMainContact: c.isMainContact,
        isNew: false,
      }));

      // Merge with any unsaved new contacts
      setContacts((prevContacts) => {
        const newContacts = prevContacts.filter((c) => c.isNew);
        return [...savedContacts, ...newContacts];
      });
    }
  }, [existingContacts]);

  const handleAddMore = () => {
    setContacts([
      ...contacts,
      {
        firstName: "",
        lastName: "",
        email: "",
        isMainContact: false,
        isNew: true,
      },
    ]);
    setEditingIndex(contacts.length);
  };

  const handleSaveContact = async (
    index: number,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => {
    const contact = contacts[index];
    setSaving(true);
    try {
      if (contact.id && !contact.isNew) {
        // Update existing contact
        await onUpdateContact(contact.id, data);
      } else {
        // Create new contact
        await onAddContact(data);
      }

      // Update local state
      const updatedContacts = [...contacts];
      updatedContacts[index] = {
        ...updatedContacts[index],
        ...data,
        id: contact.id || `temp-${index}`,
        isNew: false,
      };
      setContacts(updatedContacts);
      setEditingIndex(null);
    } catch (err) {
      console.error("Error saving contact:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (index: number) => {
    const contact = contacts[index];
    if (contact.id && !contact.isNew) {
      if (!confirm("Are you sure you want to delete this contact?")) {
        return;
      }
      await onDeleteContact(contact.id);
    }
    const updatedContacts = contacts.filter((_, i) => i !== index);
    // Ensure at least one contact remains
    if (updatedContacts.length === 0) {
      setContacts([
        {
          firstName: "",
          lastName: "",
          email: "",
          isMainContact: true,
          isNew: true,
        },
      ]);
    } else {
      setContacts(updatedContacts);
    }
    setEditingIndex(null);
  };

  const handleEditContact = (index: number) => {
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const allContactsSaved = contacts.every((c) => !c.isNew && c.firstName && c.lastName && c.email);

  return (
    <div className="bg-background-secondary rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-2">Add Contact Persons</h2>
      <p className="text-sm text-gray-600 mb-6">for {vendorName}</p>

      <div className="space-y-4">
        {contacts.map((contact, index) => {
          const isEditing = editingIndex === index;
          const isFirstContact = index === 0;

          if (isEditing) {
            return (
              <div key={contact.id || `contact-${index}`} className="border border-gray-200 rounded-lg p-4">
                <ContactPersonForm
                  vendorId={vendorId}
                  vendorName={vendorName}
                  existingContact={
                    contact.id && !contact.isNew
                      ? {
                          id: contact.id,
                          vendorId,
                          firstName: contact.firstName,
                          lastName: contact.lastName,
                          email: contact.email,
                          isMainContact: contact.isMainContact,
                          createdAt: "",
                          updatedAt: "",
                        }
                      : undefined
                  }
                  isFirstContact={isFirstContact && contacts.length === 1}
                  onSubmit={async (data) => {
                    await handleSaveContact(index, data);
                  }}
                  onCancel={handleCancelEdit}
                />
              </div>
            );
          }

          return (
            <div
              key={contact.id || `contact-${index}`}
              className="flex items-center justify-between bg-background-primary p-4 rounded-lg border border-border-primary"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {contact.firstName} {contact.lastName}
                  </span>
                  {contact.isMainContact && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                      Main Contact
                    </span>
                  )}
                  {contact.isNew && (
                    <span className="text-xs text-gray-500 italic">(Not saved)</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">{contact.email}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditContact(index)}
                  className="text-primary-600 hover:text-primary-900 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteContact(index)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleAddMore}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 flex items-center gap-2"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add More People
          </button>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={onComplete}
            disabled={!allContactsSaved || saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Done"}
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}


