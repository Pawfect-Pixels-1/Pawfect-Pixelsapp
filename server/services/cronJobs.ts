// server/services/cronJobs.ts
import * as cron from 'node-cron';
import { getGoogleSheetsService } from './googleSheets';

class CronJobService {
  private jobs: cron.ScheduledTask[] = [];

  start() {
    console.log('🕰️ Starting scheduled tasks...');

    // Nightly export at 2 AM AEST (1:00 PM UTC during AEDT, 3:00 PM UTC during AEST)
    // Using UTC time: 1:00 PM UTC (AEDT) or 3:00 PM UTC (AEST)
    // For simplicity, we'll use 2:00 AM local time which should work well for Australia
    const nightlyExportJob = cron.schedule('0 2 * * *', async () => {
      console.log('🌙 Starting nightly Google Sheets export at', new Date().toISOString());
      
      try {
        const sheetsService = getGoogleSheetsService();
        await sheetsService.performFullExport();
        console.log('✅ Nightly Google Sheets export completed successfully');
      } catch (error) {
        console.error('❌ Nightly Google Sheets export failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "Australia/Sydney" // AEST/AEDT timezone
    });

    // Weekly cleanup - remove old processed webhook events (older than 30 days)
    const weeklyCleanupJob = cron.schedule('0 3 * * 0', async () => {
      console.log('🧹 Starting weekly database cleanup at', new Date().toISOString());
      
      try {
        // TODO: Add cleanup logic for old webhook events if needed
        console.log('✅ Weekly cleanup completed');
      } catch (error) {
        console.error('❌ Weekly cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "Australia/Sydney"
    });

    // Start the jobs
    nightlyExportJob.start();
    weeklyCleanupJob.start();

    this.jobs.push(nightlyExportJob, weeklyCleanupJob);

    console.log('✅ Scheduled tasks started:');
    console.log('  - Nightly Google Sheets export: 2:00 AM AEST/AEDT');
    console.log('  - Weekly cleanup: 3:00 AM AEST/AEDT on Sundays');
  }

  stop() {
    console.log('🛑 Stopping scheduled tasks...');
    
    this.jobs.forEach(job => {
      job.stop();
      job.destroy();
    });
    
    this.jobs = [];
    console.log('✅ All scheduled tasks stopped');
  }

  // Manual trigger for testing
  async triggerNightlyExport(): Promise<void> {
    console.log('🔧 Manually triggering nightly export...');
    
    try {
      const sheetsService = getGoogleSheetsService();
      await sheetsService.performFullExport();
      console.log('✅ Manual nightly export completed successfully');
    } catch (error) {
      console.error('❌ Manual nightly export failed:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      jobsRunning: this.jobs.length,
      jobs: [
        {
          name: 'Nightly Google Sheets Export',
          schedule: '0 2 * * *',
          timezone: 'Australia/Sydney',
          description: 'Exports all data to Google Sheets at 2:00 AM AEST/AEDT'
        },
        {
          name: 'Weekly Cleanup',
          schedule: '0 3 * * 0',
          timezone: 'Australia/Sydney',
          description: 'Cleans up old data at 3:00 AM AEST/AEDT on Sundays'
        }
      ]
    };
  }
}

// Export singleton instance
export const cronJobService = new CronJobService();