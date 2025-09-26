// server/services/googleSheets.ts
import { google } from 'googleapis';
import { db } from '../storage';
import { users, userBilling, processedWebhookEvents } from '../../shared/schema';
import { eq, sql, desc, gte } from 'drizzle-orm';

interface GoogleSheetsConfig {
  clientEmail: string;
  privateKey: string;
  folderId?: string;
  spreadsheetTitle: string;
}

interface SyncState {
  lastExportedUserId?: number;
  lastExportedWebhookId?: number;
  lastExportTimestamp?: string;
}

interface ExportData {
  users: any[];
  billing: any[];
  webhookEvents: any[];
}

class GoogleSheetsService {
  private auth: any;
  private sheets: any;
  private drive: any;
  private config: GoogleSheetsConfig;
  private spreadsheetId: string | null = null;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
    this.initializeAuth();
  }

  private initializeAuth() {
    // Clean up the private key (handle escaped newlines)
    const privateKey = this.config.privateKey.replace(/\\n/g, '\n');
    
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: this.config.clientEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async getOrCreateSpreadsheet(): Promise<string> {
    if (this.spreadsheetId) {
      return this.spreadsheetId;
    }

    // Check if spreadsheet already exists
    try {
      const existingSheets = await this.drive.files.list({
        q: `name='${this.config.spreadsheetTitle}' and mimeType='application/vnd.google-apps.spreadsheet'`,
        fields: 'files(id, name)',
      });

      if (existingSheets.data.files && existingSheets.data.files.length > 0) {
        this.spreadsheetId = existingSheets.data.files[0].id!;
        console.log(`📊 Using existing spreadsheet: ${this.spreadsheetId}`);
        return this.spreadsheetId;
      }
    } catch (error) {
      console.error('Error checking for existing spreadsheet:', error);
    }

    // Create new spreadsheet
    const spreadsheet = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: this.config.spreadsheetTitle,
        },
        sheets: [
          { properties: { title: 'Users' } },
          { properties: { title: 'Billing' } },
          { properties: { title: 'Webhook Events' } },
          { properties: { title: 'Sync State' } },
        ],
      },
    });

    this.spreadsheetId = spreadsheet.data.spreadsheetId!;
    console.log(`📊 Created new spreadsheet: ${this.spreadsheetId}`);

    // Move to folder if specified
    if (this.config.folderId) {
      try {
        await this.drive.files.update({
          fileId: this.spreadsheetId,
          addParents: this.config.folderId,
          removeParents: 'root',
        });
        console.log(`📁 Moved spreadsheet to folder: ${this.config.folderId}`);
      } catch (error) {
        console.error('Error moving spreadsheet to folder:', error);
      }
    }

    return this.spreadsheetId;
  }

  async getSyncState(): Promise<SyncState> {
    try {
      const spreadsheetId = await this.getOrCreateSpreadsheet();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sync State!A:B',
      });

      const rows = response.data.values || [];
      const syncState: SyncState = {};

      rows.forEach((row: string[]) => {
        if (row.length >= 2) {
          const [key, value] = row;
          switch (key) {
            case 'lastExportedUserId':
              syncState.lastExportedUserId = parseInt(value, 10);
              break;
            case 'lastExportedWebhookId':
              syncState.lastExportedWebhookId = parseInt(value, 10);
              break;
            case 'lastExportTimestamp':
              syncState.lastExportTimestamp = value;
              break;
          }
        }
      });

      return syncState;
    } catch (error) {
      console.error('Error getting sync state:', error);
      return {};
    }
  }

  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    try {
      const spreadsheetId = await this.getOrCreateSpreadsheet();
      const currentState = await this.getSyncState();
      const newState = { ...currentState, ...updates };

      const values = [
        ['Key', 'Value'],
        ['lastExportedUserId', newState.lastExportedUserId?.toString() || ''],
        ['lastExportedWebhookId', newState.lastExportedWebhookId?.toString() || ''],
        ['lastExportTimestamp', newState.lastExportTimestamp || ''],
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sync State!A:B',
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      console.log('✅ Updated sync state:', updates);
    } catch (error) {
      console.error('Error updating sync state:', error);
      throw error;
    }
  }

  async fetchNewData(syncState: SyncState): Promise<ExportData> {
    const data: ExportData = {
      users: [],
      billing: [],
      webhookEvents: [],
    };

    try {
      // Fetch new users
      let usersQuery = db.select().from(users).orderBy(users.id);
      if (syncState.lastExportedUserId) {
        usersQuery = usersQuery.where(sql`${users.id} > ${syncState.lastExportedUserId}`);
      }
      data.users = await usersQuery.limit(1000); // Batch limit

      // Fetch new billing records
      const billingRecords = await db.select({
        userId: userBilling.userId,
        plan: userBilling.plan,
        status: userBilling.status,
        stripeSubscriptionId: userBilling.stripeSubscriptionId,
        currentPeriodEnd: userBilling.currentPeriodEnd,
        createdAt: userBilling.createdAt,
        updatedAt: userBilling.updatedAt,
      }).from(userBilling).orderBy(userBilling.userId);
      data.billing = billingRecords;

      // Fetch new webhook events
      let eventsQuery = db.select().from(processedWebhookEvents).orderBy(desc(processedWebhookEvents.id));
      if (syncState.lastExportedWebhookId) {
        eventsQuery = eventsQuery.where(sql`${processedWebhookEvents.id} > ${syncState.lastExportedWebhookId}`);
      }
      data.webhookEvents = await eventsQuery.limit(1000); // Batch limit

      console.log(`📊 Fetched ${data.users.length} users, ${data.billing.length} billing records, ${data.webhookEvents.length} webhook events`);
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  async upsertDataToSheet(sheetName: string, headers: string[], data: any[]): Promise<void> {
    if (data.length === 0) {
      console.log(`⏭️ No data to export for ${sheetName}`);
      return;
    }

    try {
      const spreadsheetId = await this.getOrCreateSpreadsheet();

      // Check if headers exist, if not, add them
      const existingData = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
      });

      const needsHeaders = !existingData.data.values || existingData.data.values.length === 0;

      // Prepare data rows
      const rows = data.map(item => {
        return headers.map(header => {
          const value = item[header];
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return value.toISOString();
          return String(value);
        });
      });

      // Add headers if needed
      if (needsHeaders) {
        rows.unshift(headers);
      }

      // Get the next available row
      const sheetData = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });
      const nextRow = (sheetData.data.values?.length || 0) + 1;

      // Append data
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${needsHeaders ? 1 : nextRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      });

      console.log(`✅ Exported ${data.length} rows to ${sheetName}`);
    } catch (error) {
      console.error(`Error exporting to ${sheetName}:`, error);
      throw error;
    }
  }

  async performFullExport(): Promise<void> {
    console.log('🚀 Starting full Google Sheets export...');
    
    try {
      const syncState = await this.getSyncState();
      const data = await this.fetchNewData(syncState);

      // Export users
      if (data.users.length > 0) {
        const userHeaders = ['id', 'email', 'stripeCustomerId', 'plan', 'creditsBalance', 'includedCreditsThisCycle', 'isPriorityQueue', 'createdAt', 'updatedAt'];
        await this.upsertDataToSheet('Users', userHeaders, data.users);
      }

      // Export billing
      if (data.billing.length > 0) {
        const billingHeaders = ['userId', 'plan', 'status', 'stripeSubscriptionId', 'currentPeriodEnd', 'createdAt', 'updatedAt'];
        await this.upsertDataToSheet('Billing', billingHeaders, data.billing);
      }

      // Export webhook events
      if (data.webhookEvents.length > 0) {
        const webhookHeaders = ['id', 'eventId', 'eventType', 'processedAt'];
        await this.upsertDataToSheet('Webhook Events', webhookHeaders, data.webhookEvents);
      }

      // Update sync state
      const updates: Partial<SyncState> = {
        lastExportTimestamp: new Date().toISOString(),
      };

      if (data.users.length > 0) {
        updates.lastExportedUserId = Math.max(...data.users.map(u => u.id));
      }

      if (data.webhookEvents.length > 0) {
        updates.lastExportedWebhookId = Math.max(...data.webhookEvents.map(e => e.id));
      }

      await this.updateSyncState(updates);

      console.log('✅ Google Sheets export completed successfully');
    } catch (error) {
      console.error('❌ Google Sheets export failed:', error);
      throw error;
    }
  }

  async exportStripeEvent(eventData: any): Promise<void> {
    try {
      const spreadsheetId = await this.getOrCreateSpreadsheet();
      
      // Prepare webhook event data
      const webhookRow = [
        eventData.id,
        eventData.type,
        new Date().toISOString(),
        JSON.stringify(eventData.data)
      ];

      // Get next row
      const sheetData = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Webhook Events!A:A',
      });
      const nextRow = (sheetData.data.values?.length || 0) + 1;

      // Add headers if this is the first row
      if (nextRow === 1) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Webhook Events!A1',
          valueInputOption: 'RAW',
          requestBody: { 
            values: [['Event ID', 'Event Type', 'Processed At', 'Event Data']]
          },
        });
      }

      // Append the webhook event
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Webhook Events!A:D',
        valueInputOption: 'RAW',
        requestBody: { values: [webhookRow] },
      });

      console.log(`📊 Streamed webhook event ${eventData.type} to Google Sheets`);
    } catch (error) {
      console.error('Error streaming webhook event to Google Sheets:', error);
      // Don't throw here - we don't want to break webhook processing
    }
  }
}

// Create and export singleton instance
let sheetsService: GoogleSheetsService | null = null;

export function getGoogleSheetsService(): GoogleSheetsService {
  if (!sheetsService) {
    const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY;
    const folderId = process.env.GSHEETS_FOLDER_ID;
    const spreadsheetTitle = process.env.GSHEETS_SPREADSHEET_TITLE || 'Portrait Studio - Data Lake';

    if (!clientEmail || !privateKey) {
      throw new Error('Missing required Google Sheets credentials: GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY');
    }

    sheetsService = new GoogleSheetsService({
      clientEmail,
      privateKey,
      folderId,
      spreadsheetTitle,
    });
  }

  return sheetsService;
}

export { GoogleSheetsService };