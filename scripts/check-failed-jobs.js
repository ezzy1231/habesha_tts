import dotenv from 'dotenv';
dotenv.config();

import { ttsQueue } from '../backend/queue-optimized.js';

console.log('🔍 Checking Failed Jobs\n');

async function checkFailedJobs() {
  try {
    const failedJobs = await ttsQueue.getJobs(['failed'], 0, 10);
    
    if (failedJobs.length === 0) {
      console.log('✅ No failed jobs found!');
    } else {
      console.log(`❌ Found ${failedJobs.length} failed jobs:\n`);
      
      for (const job of failedJobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`Donation ID: ${job.data?.donationId}`);
        console.log(`Text: ${job.data?.text?.substring(0, 100) || 'N/A'}...`);
        console.log(`Failed Reason: ${job.failedReason}`);
        console.log(`Stack Trace: ${job.stacktrace?.join('\n') || 'N/A'}`);
        console.log('---\n');
      }
    }

    // Check active jobs too
    console.log('\n🔄 Active Jobs:');
    const activeJobs = await ttsQueue.getJobs(['active'], 0, 5);
    if (activeJobs.length === 0) {
      console.log('No active jobs');
    } else {
      for (const job of activeJobs) {
        console.log(`Job ID: ${job.id} - Donation: ${job.data?.donationId}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await ttsQueue.close();
    process.exit(0);
  }
}

checkFailedJobs();
