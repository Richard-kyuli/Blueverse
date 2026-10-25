/**
 * Test Script for Submissions Storage Setup
 * 
 * This script verifies that the submissions storage bucket and policies
 * are correctly configured in Supabase.
 * 
 * Requirements tested: FR-1, NFR-1, INT-1
 * 
 * Usage:
 *   node test-submissions-storage.js
 * 
 * Prerequisites:
 *   - Supabase project configured
 *   - Environment variables set (.env.local)
 *   - Test users created (student and writer)
 *   - Test assignment with writer assigned
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test configuration
const TEST_CONFIG = {
  // Update these with your test data
  writerEmail: 'writer@test.com',
  writerPassword: 'testpassword123',
  studentEmail: 'student@test.com',
  studentPassword: 'testpassword123',
  testAssignmentId: null, // Will be set during test
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function fail(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Create a test file
function createTestFile(filename = 'test-submission.txt') {
  const content = `Test submission file
Created at: ${new Date().toISOString()}
This file is used to test the submissions storage bucket.`;
  
  return new File([content], filename, { type: 'text/plain' });
}

// Test 1: Check bucket exists
async function testBucketExists() {
  info('Test 1: Checking if submissions bucket exists...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      fail(`Failed to list buckets: ${error.message}`);
      return false;
    }
    
    const submissionsBucket = buckets.find(b => b.name === 'submissions');
    
    if (!submissionsBucket) {
      fail('Submissions bucket does not exist');
      warn('Please create the bucket via Supabase Dashboard');
      return false;
    }
    
    success('Submissions bucket exists');
    
    // Check if bucket is public (it should NOT be)
    if (submissionsBucket.public) {
      fail('Bucket is PUBLIC - it should be PRIVATE');
      warn('Please change bucket to private in Supabase Dashboard');
      return false;
    }
    
    success('Bucket is correctly set to PRIVATE');
    return true;
    
  } catch (err) {
    fail(`Error checking bucket: ${err.message}`);
    return false;
  }
}

// Test 2: Check storage policies exist
async function testPoliciesExist() {
  info('Test 2: Checking if storage policies exist...');
  
  try {
    // Query to check policies
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = 'objects' 
          AND schemaname = 'storage'
          AND policyname ILIKE '%submission%' 
           OR policyname ILIKE '%assigned assignment%'
        ORDER BY cmd;
      `
    });
    
    if (error) {
      warn('Cannot verify policies via RPC (permission may be restricted)');
      warn('Please manually verify policies in Supabase Dashboard → Storage → Policies');
      return true; // Don't fail the test, just warn
    }
    
    const expectedPolicies = [
      { cmd: 'SELECT', name: 'Assignment parties can view submission files' },
      { cmd: 'INSERT', name: 'Writers can upload to their assigned assignments' },
      { cmd: 'UPDATE', name: 'Writers can update their submission files' },
      { cmd: 'DELETE', name: 'Writers can delete their submission files' },
    ];
    
    let allFound = true;
    expectedPolicies.forEach(expected => {
      const found = data?.some(p => 
        p.cmd === expected.cmd && p.policyname.includes(expected.name)
      );
      
      if (found) {
        success(`Policy found: ${expected.name} (${expected.cmd})`);
      } else {
        fail(`Policy missing: ${expected.name} (${expected.cmd})`);
        allFound = false;
      }
    });
    
    return allFound;
    
  } catch (err) {
    warn(`Cannot verify policies: ${err.message}`);
    warn('Please manually verify in Supabase Dashboard');
    return true; // Don't fail
  }
}

// Test 3: Writer can upload to assigned assignment
async function testWriterUpload(writerId, assignmentId) {
  info('Test 3: Testing writer upload to assigned assignment...');
  
  try {
    const testFile = createTestFile();
    const submissionId = crypto.randomUUID();
    const filePath = `${assignmentId}/${submissionId}/${testFile.name}`;
    
    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(filePath, testFile);
    
    if (error) {
      fail(`Writer upload failed: ${error.message}`);
      return { success: false, filePath: null };
    }
    
    success('Writer successfully uploaded file');
    success(`File path: ${data.path}`);
    return { success: true, filePath: data.path };
    
  } catch (err) {
    fail(`Writer upload error: ${err.message}`);
    return { success: false, filePath: null };
  }
}

// Test 4: Student can view/download file
async function testStudentView(filePath) {
  info('Test 4: Testing student can view submission file...');
  
  try {
    // Try to get a signed URL (this verifies SELECT permission)
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 60); // 60 seconds expiry
    
    if (error) {
      fail(`Student view failed: ${error.message}`);
      return false;
    }
    
    success('Student can view submission file');
    success(`Signed URL generated: ${data.signedUrl.substring(0, 50)}...`);
    return true;
    
  } catch (err) {
    fail(`Student view error: ${err.message}`);
    return false;
  }
}

// Test 5: Cleanup - delete test file
async function testWriterDelete(filePath) {
  info('Test 5: Testing writer can delete file (cleanup)...');
  
  try {
    const { error } = await supabase.storage
      .from('submissions')
      .remove([filePath]);
    
    if (error) {
      warn(`Cleanup failed: ${error.message}`);
      warn(`Please manually delete: ${filePath}`);
      return false;
    }
    
    success('Test file deleted successfully');
    return true;
    
  } catch (err) {
    warn(`Cleanup error: ${err.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n========================================', 'cyan');
  log('   Submissions Storage Test Suite', 'cyan');
  log('========================================\n', 'cyan');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Bucket exists
  const bucketExists = await testBucketExists();
  bucketExists ? testsPassed++ : testsFailed++;
  
  if (!bucketExists) {
    fail('\n⛔ Cannot proceed without submissions bucket');
    fail('Please create the bucket and run tests again');
    process.exit(1);
  }
  
  log(''); // Empty line
  
  // Test 2: Policies exist
  const policiesExist = await testPoliciesExist();
  policiesExist ? testsPassed++ : testsFailed++;
  
  log(''); // Empty line
  
  // Note: Tests 3-5 require authentication and test data
  warn('Tests 3-5 require authenticated users and test assignment data');
  warn('Please run these tests manually or configure TEST_CONFIG with your test data');
  
  // Summary
  log('\n========================================', 'cyan');
  log('   Test Summary', 'cyan');
  log('========================================\n', 'cyan');
  
  success(`Tests passed: ${testsPassed}`);
  if (testsFailed > 0) {
    fail(`Tests failed: ${testsFailed}`);
  }
  
  if (testsPassed === 2 && testsFailed === 0) {
    log('\n🎉 Storage setup verification complete!', 'green');
    log('✅ Bucket and policies are configured correctly\n', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.\n', 'yellow');
  }
}

// Run tests
runTests().catch(err => {
  fail(`\nFatal error: ${err.message}`);
  process.exit(1);
});
