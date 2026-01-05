"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Breadcrumbs, PageHeader, Card, CardBody, LoadingSpinner, Tabs, TabsList, TabsTrigger, TabsContent, Button, FormField, Input } from "@/components/ui";
import { GraphicsUpload } from "@/components/GraphicsUpload";
import { BrregSearchResult } from "@/lib/api";

interface CompanySettings {
  id: string;
  name: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
  subscriptionStatus: "Trial" | "Active" | "Expired";
  subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null;
  subscriptionExpiresAt?: string | null;
  trialStartedAt?: string | null;
  logoData?: string | null;
  logoFileName?: string | null;
  logoFileType?: string | null;
  logoShape?: string | null;
  logoPlacement?: string | null;
  logoBorder?: string | null;
  bannerData?: string | null;
  bannerFileName?: string | null;
  bannerFileType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalOrgNumber, setOriginalOrgNumber] = useState("");
  
  // Brreg lookup state
  const [lookingUpOrgNumber, setLookingUpOrgNumber] = useState(false);
  const [brregName, setBrregName] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<BrregSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [companySelected, setCompanySelected] = useState(true);
  const orgNumberLookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  
  // Logo config state
  const [logoConfig, setLogoConfig] = useState({
    logoShape: "rounded-rect" as string,
    logoPlacement: "overlay-bottom-left" as string,
    logoBorder: "none" as string,
  });
  const [savingLogoConfig, setSavingLogoConfig] = useState(false);
  
  // Stats
  const [userCount, setUserCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);

  const isAdmin =
    user?.role === "CompanyAdministrator" ||
    user?.role === "GlobalAdministrator";

  useEffect(() => {
    if (!user) return;

    // Redirect if not admin
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }

    const loadCompanySettings = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get company settings
        const companySettings = await api.company.getSettings();
        setSettings(companySettings);
        const companyName = companySettings.name || "";
        setName(companyName);
        setOriginalName(companyName);
        setEmailDomain(companySettings.emailDomain || "");
        const orgNumber = companySettings.organizationNumber || "";
        setOrganizationNumber(orgNumber);
        setOriginalOrgNumber(orgNumber);
        setCompanySelected(true);
        
        // Set logo config from settings
        if (companySettings.logoShape || companySettings.logoPlacement || companySettings.logoBorder) {
          setLogoConfig({
            logoShape: companySettings.logoShape || "rounded-rect",
            logoPlacement: companySettings.logoPlacement || "overlay-bottom-left",
            logoBorder: companySettings.logoBorder || "none",
          });
        }
        
        // Get company users count
        const companyUsers = await api.users.getCompanyUsers();
        setUserCount(companyUsers.length);
        
        // Get projects count
        const projects = await api.projects.list();
        const companyProjects = projects.filter(
          (p) => p.tenantId === user.tenantId
        );
        setProjectCount(companyProjects.length);
      } catch (err: any) {
        console.error("Failed to load company settings:", err);
        setError(err.message || "Failed to load company settings");
      } finally {
        setLoading(false);
      }
    };

    loadCompanySettings();
  }, [user, router, isAdmin]);

  // Search brreg.no when user types company name
  useEffect(() => {
    // Don't search if name is too short
    if (name.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Check if name has changed from original
    const nameChanged = originalName && name !== originalName;
    
    // Search should trigger if:
    // 1. Company is not selected, OR
    // 2. Name has changed from original
    const shouldSearch = !companySelected || nameChanged;
    
    if (!shouldSearch) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.vendors.search(name);
        setSearchResults(response.results);
        setShowResults(true);
      } catch (err: any) {
        console.error("Search error:", err);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [name, companySelected, originalName]);

  // Lookup organization number in brreg when it's entered (only if it changed)
  useEffect(() => {
    // Don't lookup if still loading or if org number hasn't changed from original
    if (loading) {
      return;
    }

    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    const cleanOriginalOrgNumber = originalOrgNumber.replace(/\D/g, "");
    
    // Only lookup if org number has changed from original
    if (cleanOrgNumber === cleanOriginalOrgNumber) {
      return;
    }

    if (cleanOrgNumber.length !== 9) {
      setBrregName(null);
      return;
    }

    if (orgNumberLookupTimeoutRef.current) {
      clearTimeout(orgNumberLookupTimeoutRef.current);
    }

    orgNumberLookupTimeoutRef.current = setTimeout(async () => {
      setLookingUpOrgNumber(true);
      try {
        const details = await api.vendors.getBrregData(cleanOrgNumber);
        setBrregName(details.name);
        
        // Always update company name to match brreg when org number is found
        if (name !== details.name) {
          setName(details.name);
          setCompanySelected(true);
        }
      } catch (err: any) {
        if (
          err.message?.includes("not found") ||
          err.message?.includes("404")
        ) {
          setBrregName(null);
        } else {
          console.error("Error looking up organization number:", err);
          setBrregName(null);
        }
      } finally {
        setLookingUpOrgNumber(false);
      }
    }, 500);

    return () => {
      if (orgNumberLookupTimeoutRef.current) {
        clearTimeout(orgNumberLookupTimeoutRef.current);
      }
    };
  }, [organizationNumber, name, originalOrgNumber, loading]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCompany = async (result: BrregSearchResult) => {
    setName(result.name);
    setOrganizationNumber(result.organizationNumber);
    setCompanySelected(true);
    setShowResults(false);

    try {
      const details = await api.vendors.getBrregData(result.organizationNumber);
      setBrregName(details.name);

      if (details.website) {
        try {
          const url = new URL(
            details.website.startsWith("http") ? details.website : `https://${details.website}`
          );
          setEmailDomain(url.hostname.replace("www.", ""));
        } catch {
          // Invalid URL, ignore
        }
      }
    } catch (err: any) {
      console.error("Error fetching company details:", err);
    }
  };

  const handleCompanyNameChange = (value: string) => {
    setName(value);
    // If user clears or significantly changes the name, allow search
    if (value.length < 2 || value !== originalName) {
      setCompanySelected(false);
    }
  };

  const handleCompanyNameBlur = () => {
    // Delay hiding results to allow click on dropdown item
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      setFormError(null);
      
      const updated = await api.company.updateSettings({
        name: name.trim(),
        emailDomain: emailDomain.trim() || null,
        organizationNumber: organizationNumber.trim() || null,
      });
      
      setSettings(updated);
      setOriginalName(name.trim());
      setOriginalOrgNumber(updated.organizationNumber || "");
      setCompanySelected(true);
      setError(null);
      setShowResults(false);
    } catch (err: any) {
      console.error("Failed to save company settings:", err);
      const errorMessage = err.response?.message || err.message || "Failed to save company settings";
      setFormError(errorMessage);
      
      // If brreg validation failed, show the expected name
      if (err.response?.brregName) {
        setFormError(`${errorMessage}. Expected name: "${err.response.brregName}"`);
        setBrregName(err.response.brregName);
        // Auto-update name to match brreg
        setName(err.response.brregName);
        setCompanySelected(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const formatSubscriptionStatus = (status: string) => {
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  const formatSubscriptionTier = (tier: string | null | undefined) => {
    if (!tier) return "N/A";
    if (tier === "Projects1") return "1 Project";
    if (tier === "Projects2") return "2 Projects";
    if (tier === "Projects5") return "5 Projects";
    if (tier === "Unlimited") return "Unlimited";
    return tier;
  };

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Company Settings" },
  ];

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">
          Loading company settings...
        </p>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader title="Company Settings" />
        <Card>
          <CardBody>
            <p className="text-red-600">{error}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <PageHeader title="Company Settings" />

      {/* Subscription Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Subscription Status
            </h3>
            <p className="text-2xl font-bold text-text-primary">
              {formatSubscriptionStatus(settings.subscriptionStatus)}
            </p>
            {settings.subscriptionExpiresAt && (
              <p className="text-sm text-text-secondary mt-1">
                Expires: {new Date(settings.subscriptionExpiresAt).toLocaleDateString()}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Subscription Tier
            </h3>
            <p className="text-2xl font-bold text-text-primary">
              {formatSubscriptionTier(settings.subscriptionTier)}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Project limit
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Users
            </h3>
            <p className="text-3xl font-bold text-text-primary">
              {userCount}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Total company users
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Projects
            </h3>
            <p className="text-3xl font-bold text-text-primary">
              {projectCount}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Total company projects
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Main Settings Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="graphics">Graphics</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold text-text-primary mb-4">
                Company Information
              </h2>
              
              {formError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Company Name with Search */}
                <div className="relative" ref={resultsRef}>
                  <FormField label="Company Name" required error={!name.trim() && formError ? formError : undefined}>
                    <div className="relative">
                      <Input
                        ref={companyInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => handleCompanyNameChange(e.target.value)}
                        onFocus={() => {
                          if (searchResults.length > 0 && !companySelected) {
                            setShowResults(true);
                          }
                        }}
                        onBlur={handleCompanyNameBlur}
                        placeholder="Type company name (searches Norwegian companies)"
                        hasError={!name.trim() && !!formError}
                      />
                      {searching && (
                        <div className="absolute right-3 top-2.5">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                        </div>
                      )}
                    </div>
                  </FormField>

                  {/* Search Results Dropdown */}
                  {showResults && searchResults.length > 0 && !companySelected && (
                    <div className="absolute z-10 w-full mt-1 bg-background-tertiary border border-border-primary rounded-md shadow-lg max-h-60 overflow-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.organizationNumber}
                          type="button"
                          onClick={() => handleSelectCompany(result)}
                          className="w-full text-left px-4 py-3 hover:bg-background-primary border-b border-border-primary last:border-b-0"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">{result.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Org. nr: {result.organizationNumber}
                            {result.organizationForm && ` • ${result.organizationForm}`}
                          </div>
                          {result.address && result.address.city && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {result.address.city}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <FormField
                  label="Email Domain"
                  helperText="Optional - The email domain for this company"
                >
                  <Input
                    type="text"
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </FormField>

                <FormField
                  label="Organization Number"
                  helperText="Optional - 9 digits for Norwegian companies"
                >
                  <div className="relative">
                    <Input
                      type="text"
                      value={organizationNumber}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 9);
                        setOrganizationNumber(cleaned);
                        setBrregName(null);
                        setFormError(null);
                      }}
                      placeholder="9 digits (for Norwegian companies)"
                      maxLength={9}
                    />
                    {lookingUpOrgNumber && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                      </div>
                    )}
                  </div>
                  {brregName && (
                    <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                      ✓ Found in brreg.no: "{brregName}"
                    </p>
                  )}
                  {organizationNumber.length === 9 && !lookingUpOrgNumber && !brregName && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Organization number not found in brreg.no
                    </p>
                  )}
                </FormField>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!name.trim()}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="graphics">
          <div className="space-y-6">
            {/* Logo Section */}
            <Card>
              <CardBody>
                <h2 className="text-2xl font-semibold mb-4">Logo</h2>
                <p className="text-text-secondary mb-4">
                  Upload a logo for your company. This will be used as the default logo for new projects.
                  Accepted formats: JPG, JPEG, GIF, SVG, PNG. Maximum size: 500×500 pixels.
                </p>
                <GraphicsUpload
                  type="logo"
                  currentImage={settings.logoData ? `data:${settings.logoFileType || "image/png"};base64,${settings.logoData}` : null}
                  currentFileName={settings.logoFileName || null}
                  onUpload={async (data, fileName, fileType) => {
                    try {
                      // Extract base64 data (remove data URL prefix if present)
                      let base64Data = data;
                      if (data.startsWith("data:")) {
                        const commaIndex = data.indexOf(",");
                        if (commaIndex !== -1) {
                          base64Data = data.substring(commaIndex + 1);
                        }
                      }
                      
                      if (!base64Data || base64Data.trim().length === 0) {
                        throw new Error("Invalid image data");
                      }
                      
                      const updateResponse = await api.company.updateSettings({
                        logoData: base64Data.trim(),
                        logoFileName: fileName,
                        logoFileType: fileType,
                      });
                      
                      setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                    } catch (err: any) {
                      const errorMessage = err.message || "Failed to upload logo";
                      setFormError(errorMessage);
                      console.error("Logo upload error:", err);
                      throw err;
                    }
                  }}
                  onDelete={async () => {
                    await api.company.updateSettings({
                      logoData: null,
                      logoFileName: null,
                      logoFileType: null,
                    });
                    const updated = await api.company.getSettings();
                    setSettings(updated);
                  }}
                  projectId={settings.id}
                />

                {/* Logo Configuration */}
                {settings.logoData && (
                  <div className="mt-6 space-y-4 pt-6 border-t border-border-primary">
                    <h3 className="text-lg font-semibold mb-4">Logo Configuration</h3>
                    
                    {/* Shape Rocker Switch */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-text-primary">
                        Shape
                      </label>
                      <div className="flex border border-gray-300 rounded-md overflow-hidden w-fit">
                        <button
                          type="button"
                          onClick={async () => {
                            const newShape = "rounded-rect";
                            const currentPlacement = settings?.logoPlacement || "overlay-bottom-left";
                            const currentBorder = settings?.logoBorder || "none";
                            setLogoConfig({ logoShape: newShape, logoPlacement: currentPlacement, logoBorder: currentBorder });
                            setSavingLogoConfig(true);
                            try {
                              const updateResponse = await api.company.updateSettings({
                                logoShape: newShape,
                                logoPlacement: currentPlacement,
                                logoBorder: currentBorder,
                              });
                              setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                              setLogoConfig({
                                logoShape: updateResponse.logoShape || newShape,
                                logoPlacement: updateResponse.logoPlacement || logoConfig.logoPlacement,
                                logoBorder: updateResponse.logoBorder || currentBorder,
                              });
                            } catch (err: any) {
                              setFormError(err.message || "Failed to update logo shape");
                              setLogoConfig(logoConfig);
                            } finally {
                              setSavingLogoConfig(false);
                            }
                          }}
                          disabled={savingLogoConfig}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            logoConfig.logoShape === "rounded-rect"
                              ? "bg-primary-600 text-white"
                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                          } disabled:opacity-50`}
                        >
                          Rounded rect
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const newShape = "circle";
                            const currentPlacement = settings?.logoPlacement || "overlay-bottom-left";
                            const currentBorder = settings?.logoBorder || "none";
                            setLogoConfig({ logoShape: newShape, logoPlacement: currentPlacement, logoBorder: currentBorder });
                            setSavingLogoConfig(true);
                            try {
                              const updateResponse = await api.company.updateSettings({
                                logoShape: newShape,
                                logoPlacement: currentPlacement,
                                logoBorder: currentBorder,
                              });
                              setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                              setLogoConfig({
                                logoShape: updateResponse.logoShape || newShape,
                                logoPlacement: updateResponse.logoPlacement || logoConfig.logoPlacement,
                                logoBorder: updateResponse.logoBorder || currentBorder,
                              });
                            } catch (err: any) {
                              setFormError(err.message || "Failed to update logo shape");
                              setLogoConfig(logoConfig);
                            } finally {
                              setSavingLogoConfig(false);
                            }
                          }}
                          disabled={savingLogoConfig}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            logoConfig.logoShape === "circle"
                              ? "bg-primary-600 text-white"
                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                          } disabled:opacity-50`}
                        >
                          Circle
                        </button>
                      </div>
                    </div>

                    {/* Placement Dropdown */}
                    <div className="space-y-2">
                      <label htmlFor="logoPlacement" className="block text-sm font-medium text-text-primary">
                        Placement
                      </label>
                      <select
                        id="logoPlacement"
                        value={logoConfig.logoPlacement}
                        onChange={async (e) => {
                          const newPlacement = e.target.value;
                          const currentShape = settings?.logoShape || "rounded-rect";
                          const currentBorder = settings?.logoBorder || "none";
                          setLogoConfig({ logoShape: currentShape, logoPlacement: newPlacement, logoBorder: currentBorder });
                          setSavingLogoConfig(true);
                          try {
                            const updateResponse = await api.company.updateSettings({
                              logoShape: currentShape,
                              logoPlacement: newPlacement,
                              logoBorder: currentBorder,
                            });
                            setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                            setLogoConfig({
                              logoShape: updateResponse.logoShape || logoConfig.logoShape,
                              logoPlacement: updateResponse.logoPlacement || newPlacement,
                              logoBorder: updateResponse.logoBorder || logoConfig.logoBorder,
                            });
                          } catch (err: any) {
                            setFormError(err.message || "Failed to update logo placement");
                            setLogoConfig(logoConfig);
                          } finally {
                            setSavingLogoConfig(false);
                          }
                        }}
                        disabled={savingLogoConfig}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                      >
                        <option value="above-top-left">Above - Top Left</option>
                        <option value="above-center">Above - Center</option>
                        <option value="above-right">Above - Right</option>
                        <option value="overlay-top-left">Overlay - Top Left</option>
                        <option value="overlay-top-right">Overlay - Top Right</option>
                        <option value="overlay-bottom-left">Overlay - Bottom Left</option>
                        <option value="overlay-bottom-right">Overlay - Bottom Right</option>
                      </select>
                    </div>

                    {/* Border Rocker Switch (Three-way) */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-text-primary">
                        Border
                      </label>
                      <div className="flex border border-gray-300 rounded-md overflow-hidden w-fit">
                        <button
                          type="button"
                          onClick={async () => {
                            const newBorder = "none";
                            const currentShape = settings?.logoShape || "rounded-rect";
                            const currentPlacement = settings?.logoPlacement || "overlay-bottom-left";
                            setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            setSavingLogoConfig(true);
                            try {
                              const updateResponse = await api.company.updateSettings({
                                logoShape: currentShape,
                                logoPlacement: currentPlacement,
                                logoBorder: newBorder,
                              });
                              setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                              setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            } catch (err: any) {
                              setFormError(err.message || "Failed to update logo border");
                              setLogoConfig(logoConfig);
                            } finally {
                              setSavingLogoConfig(false);
                            }
                          }}
                          disabled={savingLogoConfig}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            logoConfig.logoBorder === "none"
                              ? "bg-primary-600 text-white"
                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                          } disabled:opacity-50`}
                        >
                          No border
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const newBorder = "white";
                            const currentShape = settings?.logoShape || "rounded-rect";
                            const currentPlacement = settings?.logoPlacement || "overlay-bottom-left";
                            setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            setSavingLogoConfig(true);
                            try {
                              const updateResponse = await api.company.updateSettings({
                                logoShape: currentShape,
                                logoPlacement: currentPlacement,
                                logoBorder: newBorder,
                              });
                              setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                              setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            } catch (err: any) {
                              setFormError(err.message || "Failed to update logo border");
                              setLogoConfig(logoConfig);
                            } finally {
                              setSavingLogoConfig(false);
                            }
                          }}
                          disabled={savingLogoConfig}
                          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-r border-gray-300 ${
                            logoConfig.logoBorder === "white"
                              ? "bg-primary-600 text-white"
                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                          } disabled:opacity-50`}
                        >
                          White border
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const newBorder = "black";
                            const currentShape = settings?.logoShape || "rounded-rect";
                            const currentPlacement = settings?.logoPlacement || "overlay-bottom-left";
                            setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            setSavingLogoConfig(true);
                            try {
                              const updateResponse = await api.company.updateSettings({
                                logoShape: currentShape,
                                logoPlacement: currentPlacement,
                                logoBorder: newBorder,
                              });
                              setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                              setLogoConfig({ logoShape: currentShape, logoPlacement: currentPlacement, logoBorder: newBorder });
                            } catch (err: any) {
                              setFormError(err.message || "Failed to update logo border");
                              setLogoConfig(logoConfig);
                            } finally {
                              setSavingLogoConfig(false);
                            }
                          }}
                          disabled={savingLogoConfig}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            logoConfig.logoBorder === "black"
                              ? "bg-primary-600 text-white"
                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                          } disabled:opacity-50`}
                        >
                          Black border
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Banner Section */}
            <Card>
              <CardBody>
                <h2 className="text-2xl font-semibold mb-4">Banner</h2>
                <p className="text-text-secondary mb-4">
                  Upload a banner image for your company. This will be used as the default banner for new projects.
                  Accepted formats: JPG, PNG. Maximum size: 2000×2000 pixels. The selected portion will be resized to 1200×300 pixels.
                </p>
                <GraphicsUpload
                  type="banner"
                  currentImage={settings.bannerData ? `data:${settings.bannerFileType || "image/png"};base64,${settings.bannerData}` : null}
                  currentFileName={settings.bannerFileName || null}
                  onUpload={async (data, fileName, fileType) => {
                    try {
                      // Extract base64 data (remove data URL prefix if present)
                      let base64Data = data;
                      if (data.startsWith("data:")) {
                        const commaIndex = data.indexOf(",");
                        if (commaIndex !== -1) {
                          base64Data = data.substring(commaIndex + 1);
                        }
                      }
                      
                      if (!base64Data || base64Data.trim().length === 0) {
                        throw new Error("Invalid image data");
                      }
                      
                      const updateResponse = await api.company.updateSettings({
                        bannerData: base64Data.trim(),
                        bannerFileName: fileName,
                        bannerFileType: fileType,
                      });
                      
                      setSettings((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                    } catch (err: any) {
                      const errorMessage = err.message || "Failed to upload banner";
                      setFormError(errorMessage);
                      console.error("Banner upload error:", err);
                      throw err;
                    }
                  }}
                  onDelete={async () => {
                    await api.company.updateSettings({
                      bannerData: null,
                      bannerFileName: null,
                      bannerFileType: null,
                    });
                    const updated = await api.company.getSettings();
                    setSettings(updated);
                  }}
                  projectId={settings.id}
                />
              </CardBody>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
