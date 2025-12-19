import { db } from "@dp/db";

/**
 * Helper to sync vendor status from RFI vendor response status
 * This ensures one-way sync: RFI status changes update Vendor status
 */
export async function syncVendorStatusFromRFIStatus(
  rfiVendorResponseStatus: string,
  projectVendorId: string
): Promise<void> {
  // Map RFI status to Vendor status
  // Only sync certain statuses - Rejected doesn't update vendor status
  let vendorStatus: string | null = null;
  
  switch (rfiVendorResponseStatus) {
    case "Started":
      vendorStatus = "RFI_Started";
      break;
    case "Received":
      vendorStatus = "RFI_Received";
      break;
    case "Answered":
      vendorStatus = "RFI_Answered";
      break;
    case "Sent":
      // When RFI is sent, status should be RFI_Received
      vendorStatus = "RFI_Received";
      break;
    case "Rejected":
      // Don't sync rejected status - vendor status remains as is
      return;
    default:
      // Unknown status, don't sync
      return;
  }

  // Update vendor status
  if (vendorStatus) {
    await db.projectVendor.update({
      where: { id: projectVendorId },
      data: { status: vendorStatus as any },
    });
  }
}



