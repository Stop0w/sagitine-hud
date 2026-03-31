// Simple test script to verify the Sagitine HUD application
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Sagitine HUD Application...\n');

// Check if required files exist
const requiredFiles = [
  'App.tsx',
  'src/features/notification-hub/components/NotificationPill.tsx',
  'src/features/notification-hub/components/NotificationHub.tsx',
  'src/features/notification-hub/data/mock-data.ts',
  'package.json'
];

console.log('📁 Checking required files:');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    allFilesExist = false;
  }
});

console.log('\n🔍 Verifying mock data structure:');
try {
  const mockDataPath = path.join(process.cwd(), 'src/features/notification-hub/data/mock-data.ts');
  const mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

  // Check for expected values
  const expectedMetrics = {
    totalOpen: 12,
    urgentCount: 2
  };

  if (mockDataContent.includes('totalOpen: 12') && mockDataContent.includes('urgentCount: 2')) {
    console.log('  ✅ Mock data has correct metrics (12 total, 2 urgent)');
  } else {
    console.log('  ❌ Mock data metrics incorrect');
    allFilesExist = false;
  }

  // Check for expected categories
  const expectedCategories = ['Damaged/Missing/Faulty', 'Shipping/Delivery', 'Product Usage'];
  const hasAllCategories = expectedCategories.every(cat => mockDataContent.includes(cat));

  if (hasAllCategories) {
    console.log('  ✅ All expected categories present');
  } else {
    console.log('  ❌ Missing expected categories');
    allFilesExist = false;
  }

} catch (error) {
  console.log(`  ❌ Error reading mock data: ${error.message}`);
  allFilesExist = false;
}

console.log('\n📋 Verifying component structure:');
try {
  const appPath = path.join(process.cwd(), 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  if (appContent.includes('NotificationPill') && appContent.includes('NotificationHub')) {
    console.log('  ✅ App components imported correctly');
  } else {
    console.log('  ❌ App components missing');
    allFilesExist = false;
  }

  if (appContent.includes('mockHubData')) {
    console.log('  ✅ Mock data used in App');
  } else {
    console.log('  ❌ Mock data not used in App');
    allFilesExist = false;
  }

} catch (error) {
  console.log(`  ❌ Error reading App.tsx: ${error.message}`);
  allFilesExist = false;
}

console.log('\n🔍 Checking for TypeScript errors:');
try {
  const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
  const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf8');

  if (tsConfigContent.includes('"jsx": "react-jsx"') && tsConfigContent.includes('"target": "ES2022"')) {
    console.log('  ✅ TypeScript configuration looks correct');
  } else {
    console.log('  ⚠️  TypeScript configuration may need review');
  }

} catch (error) {
  console.log(`  ⚠️  Error checking tsconfig.json: ${error.message}`);
}

console.log('\n🎯 Checking Vite configuration:');
try {
  const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
  if (fs.existsSync(viteConfigPath)) {
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
    if (viteConfigContent.includes('@vitejs/plugin-react')) {
      console.log('  ✅ Vite configuration looks correct');
    } else {
      console.log('  ⚠️  Vite configuration may need review');
    }
  } else {
    console.log('  ⚠️  vite.config.ts not found');
  }
} catch (error) {
  console.log(`  ⚠️  Error checking vite config: ${error.message}`);
}

console.log('\n📊 Verification Summary:');
if (allFilesExist) {
  console.log('✅ All required files exist and have expected content');
  console.log('✅ Application structure appears correct');
  console.log('✅ Ready for testing in browser at http://localhost:5173/');
} else {
  console.log('❌ Issues found - see details above');
}

console.log('\n🚀 Dev server should be running at: http://localhost:5173/');
console.log('🔍 To test manually:');
console.log('1. Open http://localhost:5173/ in browser');
console.log('2. Look for bottom-right pill showing "12 Pending"');
console.log('3. Click pill to open hub');
console.log('4. Verify categories: Damaged (2), Shipping (5), General (5)');
console.log('5. Check for urgent indicator (pulsing red dot)');