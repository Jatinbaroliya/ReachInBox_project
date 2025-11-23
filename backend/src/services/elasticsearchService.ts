import { Client } from '@elastic/elasticsearch';
import { IEmail } from '../models/Email';
import { isDummyMode } from '../config/runtime';

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

// Ensure the emails index exists
async function ensureIndexExists(): Promise<boolean> {
  try {
    if (isDummyMode) return false;
    
    const indexExists = await client.indices.exists({ index: 'emails' });

    if (!indexExists) {
      await client.indices.create({
        index: 'emails',
        body: {
          mappings: {
            properties: {
              messageId: { type: 'keyword' },
              account: { type: 'keyword' },
              folder: { type: 'keyword' },
              from: { type: 'text' },
              to: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              date: { type: 'date' },
              category: { type: 'keyword' }
            }
          }
        }
      });
      console.log('✅ Elasticsearch index "emails" created');
      return true;
    }
    return true;
  } catch (error) {
    console.error('❌ Error ensuring Elasticsearch index exists:', error);
    return false;
  }
}

export async function initializeElasticsearch() {
  try {
    if (isDummyMode) {
      console.warn('Elasticsearch initialization skipped in dummy mode');
      return;
    }
    
    // Check if Elasticsearch is reachable
    await client.ping();
    console.log('✅ Elasticsearch connection verified');
    
    // Ensure index exists
    await ensureIndexExists();
  } catch (error) {
    console.error('❌ Elasticsearch initialization error:', error);
    console.warn('⚠️ Elasticsearch may not be available. Search will fall back to MongoDB.');
  }
}

export async function indexEmail(email: IEmail) {
  try {
    if (isDummyMode) return;
    await client.index({
      index: 'emails',
      id: email.messageId,
      document: {
        messageId: email.messageId,
        account: email.account,
        folder: email.folder,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        date: email.date,
        category: email.category
      }
    });
  } catch (error) {
    console.error('Indexing error:', error);
  }
}

// Check if Elasticsearch is available (with timeout)
let elasticsearchAvailable = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // Check every 30 seconds

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    if (isDummyMode) return false;
    
    // Cache connection status for 30 seconds to avoid repeated checks
    const now = Date.now();
    if (elasticsearchAvailable && (now - lastConnectionCheck) < CONNECTION_CHECK_INTERVAL) {
      return true;
    }
    
    // Quick ping with timeout
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000))
    ]);
    
    elasticsearchAvailable = true;
    lastConnectionCheck = now;
    return true;
  } catch (error) {
    elasticsearchAvailable = false;
    lastConnectionCheck = Date.now();
    return false;
  }
}

export async function searchEmails(query: string, filters?: {
  account?: string;
  folder?: string;
  category?: string;
}) {
  try {
    if (isDummyMode) {
      // Controller handles dummy search; return empty here to avoid confusion
      return [];
    }

    // Check if Elasticsearch is available
    const isAvailable = await checkElasticsearchConnection();
    
    if (!isAvailable) {
      console.warn('⚠️ Elasticsearch not available, falling back to MongoDB search');
      return await searchEmailsMongoDB(query, filters);
    }

    const must: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject^2', 'body', 'from']
        }
      });
    }

    if (filters?.account) {
      must.push({ term: { account: filters.account } });
    }

    if (filters?.folder) {
      must.push({ term: { folder: filters.folder } });
    }

    if (filters?.category) {
      must.push({ term: { category: filters.category } });
    }

    // Ensure index exists before searching
    const indexExists = await ensureIndexExists();
    if (!indexExists) {
      console.warn('⚠️ Could not ensure Elasticsearch index exists, falling back to MongoDB search');
      return await searchEmailsMongoDB(query, filters);
    }

    const result = await client.search({
      index: 'emails',
      body: {
        query: {
          bool: { must }
        },
        sort: [{ date: 'desc' }],
        size: 100
      }
    });

    return result.hits.hits.map(hit => hit._source);
  } catch (error: any) {
    console.error('❌ Elasticsearch search error:', error);
    
    // Check if it's an index not found error
    if (error?.meta?.body?.error?.type === 'index_not_found_exception' || 
        error?.message?.includes('index_not_found') ||
        error?.meta?.statusCode === 404) {
      console.warn('⚠️ Elasticsearch index not found, attempting to create it...');
      try {
        await ensureIndexExists();
        console.log('✅ Index created, but search will use MongoDB for this request');
      } catch (createError) {
        console.error('❌ Failed to create index:', createError);
      }
    }
    
    console.warn('⚠️ Falling back to MongoDB search');
    // Fallback to MongoDB search
    return await searchEmailsMongoDB(query, filters);
  }
}

// MongoDB fallback search function
async function searchEmailsMongoDB(query: string, filters?: {
  account?: string;
  folder?: string;
  category?: string;
}) {
  try {
    const Email = (await import('../models/Email')).default;
    
    const searchFilter: any = {};

    // Apply filters
    if (filters?.account) {
      searchFilter.account = filters.account;
    }
    if (filters?.folder) {
      searchFilter.folder = filters.folder;
    }
    if (filters?.category) {
      searchFilter.category = filters.category;
    }

    // Build text search query
    if (query) {
      const queryLower = query.toLowerCase();
      searchFilter.$or = [
        { subject: { $regex: queryLower, $options: 'i' } },
        { body: { $regex: queryLower, $options: 'i' } },
        { from: { $regex: queryLower, $options: 'i' } }
      ];
    }

    const results = await Email.find(searchFilter)
      .sort({ date: -1 })
      .limit(100)
      .lean();

    return results;
  } catch (error) {
    console.error('❌ MongoDB search error:', error);
    return [];
  }
}