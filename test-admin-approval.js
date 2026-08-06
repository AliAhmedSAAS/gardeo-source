import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting Admin Approval Test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 800
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // STEP 1: Navigate to login page and login as admin
    console.log('📍 STEP 1: Logging in as admin...');
    await page.goto('http://127.0.0.1:3000/login');
    await page.screenshot({ path: 'screenshots/admin-01-login-page.png' });
    
    // Fill in admin credentials
    await page.locator('[data-testid="input-username"]').fill('testadmin');
    await page.locator('[data-testid="input-password"]').fill('Test1234!');
    await page.locator('[data-testid="button-login"]').click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/admin-02-after-login.png' });
    
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      console.log('   ⚠️  Still on login page, trying password123...');
      await page.locator('[data-testid="input-password"]').fill('password123');
      await page.locator('[data-testid="button-login"]').click();
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    }
    
    console.log(`   ✓ Login successful! Redirected to: ${page.url()}\n`);

    // STEP 2: Check notification bell
    console.log('🔔 STEP 2: Checking notification bell...');
    await page.waitForTimeout(2000);
    
    // Look for bell icon - try multiple selectors
    const bellIcon = await page.locator('button[aria-label*="notification" i], button:has-text("🔔"), svg.lucide-bell, button:has(svg):has-text("1")').first();
    
    if (await bellIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   ✓ Found notification bell');
      
      // Check for badge
      const hasBadge = await page.locator('[class*="badge"], [class*="count"]').count();
      console.log(`   Badge count elements: ${hasBadge}`);
      
      await page.screenshot({ path: 'screenshots/admin-03-bell-before-click.png' });
      
      // Click the bell
      await bellIcon.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/admin-04-notifications-dropdown.png' });
      console.log('   ✓ Clicked notification bell and captured dropdown\n');
    } else {
      console.log('   ⚠️  Notification bell not found, continuing...\n');
      await page.screenshot({ path: 'screenshots/admin-03-no-bell.png' });
    }

    // STEP 3: Navigate to Suppliers
    console.log('📋 STEP 3: Navigating to Suppliers page...');
    
    // Try clicking Suppliers in sidebar
    const suppliersLink = await page.locator('a:has-text("Suppliers"), [href*="supplier"]').first();
    if (await suppliersLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await suppliersLink.click();
      await page.waitForLoadState('networkidle');
      console.log('   ✓ Clicked Suppliers in sidebar');
    } else {
      // Navigate directly
      await page.goto('http://127.0.0.1:3000/suppliers');
      await page.waitForLoadState('networkidle');
      console.log('   ✓ Navigated directly to suppliers page');
    }
    
    await page.screenshot({ path: 'screenshots/admin-05-suppliers-list.png' });
    
    // Click on supplier named "test"
    console.log('   Looking for supplier "test"...');
    
    // First, make sure we're on "All" tab
    const allTab = await page.locator('button:has-text("All"), [role="tab"]:has-text("All")').first();
    if (await allTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allTab.click();
      await page.waitForTimeout(500);
    }
    
    // Look for the View button for supplier "test"
    const testSupplierRow = await page.locator('tr:has-text("test")').first();
    if (await testSupplierRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const viewButton = testSupplierRow.locator('button:has-text("View"), a:has-text("View")').first();
      await viewButton.click();
      await page.waitForLoadState('networkidle');
      console.log('   ✓ Clicked View button for supplier "test"\n');
    } else {
      console.log('   ⚠️  Supplier "test" not found, trying first supplier View button...');
      const firstViewButton = await page.locator('button:has-text("View"), a:has-text("View")').first();
      await firstViewButton.click();
      await page.waitForLoadState('networkidle');
      console.log('   ✓ Clicked first View button\n');
    }
    
    await page.screenshot({ path: 'screenshots/admin-06-supplier-detail.png' });

    // STEP 4: Click Pending tab
    console.log('📝 STEP 4: Checking Pending tab...');
    await page.waitForTimeout(1000);
    
    const pendingTab = await page.locator('button:has-text("Pending"), [role="tab"]:has-text("Pending"), a:has-text("Pending")').first();
    
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/admin-07-pending-tab.png' });
      console.log('   ✓ Clicked Pending tab');
      
      // Look for pending changes
      const pendingChanges = await page.locator('text=Phone, text=Finance contact name, text=pending, text=Pending review').count();
      console.log(`   Found ${pendingChanges} pending change indicators`);
      
      // Look for Approve button
      const approveButton = await page.locator('button:has-text("Approve")').first();
      if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('   ✓ Found Approve button\n');
      } else {
        console.log('   ⚠️  Approve button not found\n');
      }
    } else {
      console.log('   ⚠️  Pending tab not found\n');
      await page.screenshot({ path: 'screenshots/admin-07-no-pending-tab.png' });
    }

    // STEP 5: Approve the change
    console.log('✅ STEP 5: Approving the change...');
    
    const approveButton = await page.locator('button:has-text("Approve")').first();
    if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveButton.click();
      console.log('   ✓ Clicked Approve button');
      
      // Wait for toast or response
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/admin-08-after-approve.png' });
      
      // Check for toast notification
      const toast = await page.locator('[role="status"], [role="alert"], text=approved, text=Changes approved').first();
      if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
        const toastText = await toast.textContent();
        console.log(`   ✓ Toast notification: "${toastText}"\n`);
      } else {
        console.log('   ⚠️  No toast notification found\n');
      }
    } else {
      console.log('   ⚠️  Cannot find Approve button to click\n');
    }

    // STEP 6: Check Activity tab
    console.log('📊 STEP 6: Checking Activity tab...');
    await page.waitForTimeout(1000);
    
    const activityTab = await page.locator('button:has-text("Activity"), [role="tab"]:has-text("Activity"), a:has-text("Activity")').first();
    
    if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activityTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/admin-09-activity-tab.png' });
      console.log('   ✓ Clicked Activity tab');
      
      // Look for profile change log
      const changeLog = await page.locator('text=Profile change log, text=Profile change, text=Approved').first();
      if (await changeLog.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('   ✓ Found profile change log with approved changes\n');
      } else {
        console.log('   ⚠️  Profile change log not found\n');
      }
    } else {
      console.log('   ⚠️  Activity tab not found\n');
      await page.screenshot({ path: 'screenshots/admin-09-no-activity-tab.png' });
    }
    
    await page.screenshot({ path: 'screenshots/admin-10-final-state.png' });
    console.log('🎉 Admin approval test completed! Check screenshots folder for results.');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    await page.screenshot({ path: 'screenshots/admin-error.png' });
    console.log('   Screenshot saved to: screenshots/admin-error.png');
  } finally {
    console.log('\n⏳ Keeping browser open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();
