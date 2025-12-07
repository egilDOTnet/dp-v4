/**
 * Hero Banner LocalStorage Reset Utility
 * 
 * This script clears all hero banner dismissal flags from localStorage,
 * allowing all hero banners to appear again.
 * 
 * Usage:
 * 1. Open your browser's Developer Console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 * 4. Refresh the page to see all hero banners again
 * 
 * Alternatively, you can run this one-liner:
 * Object.keys(localStorage).filter(k => k.includes('hero-banner')).forEach(k => localStorage.removeItem(k))
 */

(function resetHeroBanners() {
  const heroBannerKeys = [
    'dashboard-hero-banner-dismissed',
    'tasks-hero-banner-dismissed',
    'vendors-hero-banner-dismissed',
    'requirements-hero-banner-dismissed',
    'evaluation-hero-banner-dismissed',
    'manage-hero-banner-dismissed',
    'members-hero-banner-dismissed',
    'negotiation-hero-banner-dismissed',
    'rfp-hero-banner-dismissed',
    'rfi-hero-banner-dismissed'
  ];

  let removedCount = 0;
  
  heroBannerKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      removedCount++;
    }
  });

  console.log(`✅ Hero banner reset complete!`);
  console.log(`   Removed ${removedCount} hero banner dismissal flag(s).`);
  console.log(`   Refresh the page to see all hero banners again.`);
  console.log('');
  console.log('📋 Hero banners available in:');
  console.log('   - Project Dashboard');
  console.log('   - Tasks');
  console.log('   - Vendors');
  console.log('   - Requirements');
  console.log('   - Evaluation');
  console.log('   - Manage Project');
  console.log('   - Project Members');
  console.log('   - Negotiation');
  console.log('   - RFP');
  console.log('   - RFI');
  
  return removedCount;
})();
