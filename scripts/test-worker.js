import dotenv from 'dotenv';
dotenv.config();

import { ttsQueue } from '../backend/queue-optimized.js';

console.log('🧪 Testing TTS Worker\n');

async function testWorker() {
  try {
    // Test 1: Add a simple job
    console.log('📝 Test 1: Adding a simple TTS job...');
    const job1 = await ttsQueue.add('generate-tts', {
      donationId: 9999,
      text: 'Testing the worker with a simple message',
      voice: 'Puck',
      streamer_id: '7740400643',
      amount: 10.00
    });
    console.log(`✅ Job added: ID=${job1.id}`);

    // Wait a bit for processing
    console.log('⏳ Waiting for job to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check job status
    const jobStatus1 = await job1.getState();
    console.log(`📊 Job 1 status: ${jobStatus1}`);
    
    if (jobStatus1 === 'completed') {
      const result = await job1.returnvalue;
      console.log('✅ Job 1 completed successfully!');
      console.log('   Result:', JSON.stringify(result, null, 2));
    } else if (jobStatus1 === 'failed') {
      const failedReason = job1.failedReason;
      console.error('❌ Job 1 failed:', failedReason);
    } else {
      console.log(`⏸️  Job 1 is still: ${jobStatus1}`);
    }

    console.log('\n---\n');

    // Test 2: Add another job with different parameters
    console.log('📝 Test 2: Adding a job with longer text...');
    const job2 = await ttsQueue.add('generate-tts', {
      donationId: 9998,
      text: 'This is a longer test message to see how the worker handles more text. It should generate proper audio and save it correctly.',
      voice: 'Puck',
      streamer_id: '7740400643',
      amount: 25.00
    });
    console.log(`✅ Job added: ID=${job2.id}`);

    console.log('⏳ Waiting for job to process...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const jobStatus2 = await job2.getState();
    console.log(`📊 Job 2 status: ${jobStatus2}`);
    
    if (jobStatus2 === 'completed') {
      const result = await job2.returnvalue;
      console.log('✅ Job 2 completed successfully!');
      console.log('   Result:', JSON.stringify(result, null, 2));
    } else if (jobStatus2 === 'failed') {
      const failedReason = job2.failedReason;
      console.error('❌ Job 2 failed:', failedReason);
    } else {
      console.log(`⏸️  Job 2 is still: ${jobStatus2}`);
    }

    console.log('\n---\n');

    // Test 3: Queue stats
    console.log('📊 Queue Statistics:');
    const waiting = await ttsQueue.getWaitingCount();
    const active = await ttsQueue.getActiveCount();
    const completed = await ttsQueue.getCompletedCount();
    const failed = await ttsQueue.getFailedCount();
    
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);

    console.log('\n---\n');

    // Test 4: Get recent jobs
    console.log('📋 Recent Jobs:');
    const recentJobs = await ttsQueue.getJobs(['completed', 'failed'], 0, 5);
    for (const job of recentJobs) {
      const state = await job.getState();
      console.log(`   Job ${job.id}: ${state} - ${job.data.text?.substring(0, 50)}...`);
    }

    console.log('\n✅ Worker test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Close connections
    console.log('\n🔚 Closing connections...');
    await ttsQueue.close();
    process.exit(0);
  }
}

testWorker();
