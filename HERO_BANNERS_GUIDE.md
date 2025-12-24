# Hero Banners Implementation Guide

## Overview

Hero banners have been successfully added to all project sections to guide users on what they can do within each module. Each banner:

- Appears on first visit to a section
- Can be dismissed by clicking "Understood"
- Persists dismissal state in localStorage
- Follows the same design pattern as the RFI banner

## Sections with Hero Banners

### 1. **Project Dashboard** (`/projects/[id]`)
- **LocalStorage Key:** `dashboard-hero-banner-dismissed`
- **Content:** Central hub overview, explains phase timeline, vendor/RFI/requirements widgets

### 2. **Tasks** (`/projects/[id]/tasks`)
- **LocalStorage Key:** `tasks-hero-banner-dismissed`
- **Content:** Phase-based task management, assignment, completion tracking

### 3. **Vendors** (`/projects/[id]/vendors`)
- **LocalStorage Key:** `vendors-hero-banner-dismissed`
- **Content:** Vendor management, contacts, status tracking

### 4. **Requirements** (`/projects/[id]/requirements`)
- **LocalStorage Key:** `requirements-hero-banner-dismissed`
- **Content:** Hierarchical requirement organization, priorities, statuses

### 5. **Evaluation** (`/projects/[id]/evaluation`)
- **LocalStorage Key:** `evaluation-hero-banner-dismissed`
- **Content:** Coming soon - vendor response evaluation features

### 6. **Manage Project** (`/projects/[id]/manage`)
- **LocalStorage Key:** `manage-hero-banner-dismissed`
- **Content:** Administrative controls, project details, member management

### 7. **Project Members** (`/projects/[id]/members`)
- **LocalStorage Key:** `members-hero-banner-dismissed`
- **Content:** Team management, adding users, controlling access

### 8. **Negotiation** (`/projects/[id]/negotiation`)
- **LocalStorage Key:** `negotiation-hero-banner-dismissed`
- **Content:** Coming soon - vendor negotiation features

### 9. **RFP** (`/projects/[id]/rfp`)
- **LocalStorage Key:** `rfp-hero-banner-dismissed`
- **Content:** Coming soon - Request for Proposal features

### 10. **RFI** (`/projects/[id]/rfi`)
- **LocalStorage Key:** `rfi-hero-banner-dismissed`
- **Content:** Request for Information management (already implemented)

## How to Test

### Manual Testing Steps

1. **Start the development server:**
   ```bash
   cd /Users/egil/Code/dp-v4
   pnpm turbo run dev --filter @dp/web
   ```

2. **Open your browser** and navigate to a project

3. **Visit each section** listed above

4. **Verify for each section:**
   - Hero banner appears at the top of the page
   - Banner has gradient background (primary-50 to blue-50)
   - Banner displays appropriate icon, title, and content
   - "Understood" button is visible
   
5. **Test dismissal:**
   - Click "Understood" button
   - Banner should disappear immediately
   - Refresh the page
   - Banner should NOT reappear (dismissed state persisted)

6. **Test across sections:**
   - Visit all 10 sections
   - Each should show its unique banner content
   - Each dismissal should be independent

## How to Reset All Hero Banners

### Method 1: Browser Console Script

1. Open your browser's Developer Console (press **F12** or **Cmd+Option+I**)
2. Navigate to the **Console** tab
3. Copy and paste this script:

```javascript
Object.keys(localStorage).filter(k => k.includes('hero-banner')).forEach(k => localStorage.removeItem(k))
```

4. Press **Enter**
5. Refresh the page - all banners will reappear

### Method 2: Using the Reset Script File

1. Open the file: `reset-hero-banners.js` in the project root
2. Copy the entire contents
3. Open your browser's Developer Console
4. Paste the script and press Enter
5. You'll see a confirmation message
6. Refresh the page - all banners will reappear

### Method 3: Manual LocalStorage Clearing

1. Open Developer Console (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. In the left sidebar, expand **Local Storage**
4. Click on your application's domain
5. Find and delete keys ending with `-hero-banner-dismissed`
6. Refresh the page

## Implementation Details

### Pattern Used

Each page follows this implementation pattern:

```typescript
// 1. State management
const [showHeroBanner, setShowHeroBanner] = useState(true);

// 2. Check localStorage on mount
useEffect(() => {
  const dismissed = localStorage.getItem("section-hero-banner-dismissed");
  if (dismissed === "true") {
    setShowHeroBanner(false);
  }
}, []);

// 3. Dismiss handler
const handleDismissHeroBanner = () => {
  localStorage.setItem("section-hero-banner-dismissed", "true");
  setShowHeroBanner(false);
};

// 4. JSX rendering with conditional display
{showHeroBanner && (
  <div className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-6 shadow-sm">
    {/* Banner content */}
  </div>
)}
```

### Design Consistency

All banners share:
- **Gradient background:** `from-primary-50 to-blue-50`
- **Border:** `border-primary-200`
- **Icon:** Information icon in primary-600 circle
- **Structure:** Title, description, bullet points, tip box, dismiss button
- **Tip box:** White background with emoji and italic text
- **Button:** Primary-600 with hover state

## Files Modified

All page files in the project sections:
- `/apps/web/src/app/(main)/projects/[id]/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/tasks/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/vendors/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/requirements/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/evaluation/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/manage/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/members/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/negotiation/page.tsx`
- `/apps/web/src/app/(main)/projects/[id]/rfp/page.tsx`

## Next Steps

1. **Review the banners** - Visit each section to review content and presentation
2. **Provide feedback** - Suggest any content changes or improvements
3. **Test thoroughly** - Ensure dismissal works correctly across all sections
4. **Consider refinements** - Decide if any banners need content adjustments

## Notes

- The RFI banner was already implemented and working correctly
- All new banners follow the exact same pattern for consistency
- LocalStorage keys are unique per section to allow independent dismissal
- Banners are positioned after the page title but before main content
- "Coming soon" sections have adapted content explaining future features
