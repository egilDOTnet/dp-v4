# Vendor Site Development - PR Documentation

## Overview

This PR introduces comprehensive vendor portal functionality for the Dynamic Purchase application, enabling vendors to interact with RFI (Request for Information) and RFP (Request for Proposal) processes through a dedicated portal interface.

## Key Features

### 1. Vendor RFP Portal
- **Authentication System**: Magic link and password-based authentication for vendor contacts
- **RFP Listing**: Vendors can view all RFPs they're invited to participate in
- **RFP Details**: Comprehensive RFP viewing with information, schedule, documents, and questions
- **Document Download**: "Get all" button to download all RFP documents and links as a single zip file
  - Automatically detects user's operating system (Windows, macOS, iOS)
  - Creates platform-specific link files (.url for Windows, .webloc for macOS/iOS)
  - Uses project name as the zip filename
- **Participation Management**: Vendors can participate in RFPs, submit proposals, and track their status
- **Question & Answer**: Vendors can ask questions and view answers from project administrators
- **Proposal Submission**: File upload and management for RFP proposals

### 2. Vendor RFI Portal (Enhanced)
- Magic link authentication for vendor contacts
- RFI question response interface
- Status tracking and submission workflow

### 3. RFP System Enhancements
- **About Field**: WYSIWYG editor for RFP descriptions
- **Schedule Management**: Timeline with start dates, acceptance dates, questions dates, delivery dates
- **Document Management**: Upload and link documents to RFPs
- **Question Management**: Table-based question interface with improved UX
- **Vendor Response Tracking**: Status tracking for vendor participation (Sent, Viewed, Participating, ProposalSubmitted, Declined)
- **Preview Mode**: Token-based preview functionality for RFPs

### 4. User Profile Enhancements
- Profile image upload
- Avatar color selection
- Improved profile management UX

### 5. Requirements Management
- Hierarchical requirements with drag-and-drop
- CSV/Excel export functionality
- Bulk edit and delete operations
- Import status tracking

### 6. Design System & UI Improvements
- Complete dark mode implementation
- Comprehensive design system with semantic tokens
- Hero banners across all project sections
- Responsive design improvements
- Enhanced accessibility

### 7. Testing Infrastructure
- Comprehensive test suite for API routes
- Integration tests for RFP and RFI workflows
- Test utilities and helpers
- Safety checks for test database usage

## Technical Changes

### Database Schema
- Added `RFPVendorResponse` model for tracking vendor participation
- Added `about` field to RFP model (HTML content)
- Added user profile image and color fields
- Enhanced vendor contact person relationships
- Added preview token support

### API Routes
- **Vendor RFP Routes** (`/api/vendor-rfp/*`):
  - Authentication endpoints (check-user, login, magic-link, set-password)
  - RFP listing and detail endpoints
  - Participation management
  - Question submission and viewing
  - Proposal file management
  
- **RFP Routes** (enhanced):
  - Publishing with contact person validation
  - Auto-set start date on publish
  - Preview token generation
  - Enhanced vendor response tracking

### Frontend Components
- Portal layout with authentication
- RFP listing and detail pages
- Participation modals and banners
- Question submission interface
- Proposal file upload and management
- Vendor authentication flow
- Document bulk download with OS-specific link file generation

### Middleware
- Vendor authentication middleware
- RFP access verification
- Main contact requirement checks

## Migration Notes

### Database Migrations
1. `20250120000000_add_about_to_rfp` - Adds about field to RFP
2. `20250120000001_add_rfp_vendor_portal` - Adds RFP vendor response tracking

### Environment Variables
No new environment variables required. Existing JWT_SECRET is used for vendor authentication tokens.

## Testing

### Test Coverage
- ✅ Vendor RFP authentication flows
- ✅ RFP listing and filtering
- ✅ Participation workflow
- ✅ Question submission and viewing
- ✅ Proposal file management
- ✅ Access control and permissions

### Running Tests
```bash
# Run all tests
pnpm test

# Run API tests only
pnpm test --filter @dp/api

# Run specific test file
pnpm vitest run -t "vendor-rfp"
```

### Test Database Setup
Tests require a separate test database. See `SETUP.md` for detailed instructions.

## Breaking Changes
None. This is a feature addition that doesn't break existing functionality.

## Known Issues / Limitations
- Magic links are displayed in UI during development (not sent via email)
- Test database setup required for running tests
- Preview tokens are stored in memory (should use Redis in production)

## Future Enhancements
- Email integration for magic links
- Redis-based token storage
- Enhanced proposal evaluation interface
- Vendor dashboard with statistics
- Notification system for RFP updates

## Files Changed

### New Files
- `apps/api/src/routes/vendor-rfp.ts` - Vendor RFP API routes
- `apps/api/src/middleware/vendor-auth.ts` - Vendor authentication middleware
- `apps/api/src/__tests__/routes/vendor-rfp.test.ts` - Comprehensive test suite
- `apps/web/src/app/(portal)/` - Portal pages and components
- `apps/web/src/components/portal/` - Portal-specific components

### Modified Files
- `apps/api/src/routes/rfp.ts` - Enhanced RFP publishing and management
- `packages/db/prisma/schema.prisma` - Database schema updates
- `apps/web/src/components/rfp/` - RFP component improvements
- `apps/web/src/components/portal/RFPInformation.tsx` - Added "Get all" document download feature
- `apps/web/src/lib/api.ts` - Updated RFPDetail interface to include fileData in documents
- `apps/web/package.json` - Added JSZip dependency for zip file creation
- Various UI components for design system integration

## Documentation
- Updated `SETUP.md` with test database instructions
- Added routing guide for Next.js routes
- Enhanced API documentation

## Checklist
- [x] All linting errors fixed
- [x] Code follows project conventions
- [x] Tests added/updated
- [x] Documentation updated
- [x] No breaking changes
- [x] Database migrations included
- [x] TypeScript types updated

## Review Notes

This is a large feature addition that introduces vendor portal functionality. Key areas to review:

1. **Security**: Vendor authentication and access control
2. **Database Schema**: New models and relationships
3. **API Design**: RESTful endpoints and error handling
4. **UI/UX**: Portal interface and user flows
5. **Test Coverage**: Comprehensive test suite

## Related Issues
- Vendor portal implementation
- RFP system enhancements
- User profile improvements
