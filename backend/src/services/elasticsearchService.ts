import { Client } from '@elastic/elasticsearch';
import { IEmail } from '../models/Email';
import { isDummyMode } from '../config/runtime';

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

export async function initializeElasticsearch() {
  try {
    if (isDummyMode) {
      console.warn('Elasticsearch initialization skipped in dummy mode');
      return;
    }
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
      console.log('✅ Elasticsearch index created');
    }
  } catch (error) {
    console.error('Elasticsearch initialization error:', error);
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
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}