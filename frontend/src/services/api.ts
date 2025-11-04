import axios from 'axios';
import { Email } from '../types';

// Prefer Vite env var in production; fallback to local dev default
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:5000/api';

export const fetchEmails = async (params?: any): Promise<Email[]> => {
  try {
    const response = await axios.get(`${API_BASE}/emails`, { params });
    return response.data;
  } catch (error) {
    console.error('Fetch emails error:', error);
    throw error;
  }
};

export const searchEmails = async (query: string, params?: any): Promise<any[]> => {
  try {
    const response = await axios.get(`${API_BASE}/emails/search`, {
      params: { q: query, ...params }
    });
    return response.data;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

export const getEmailById = async (id: string): Promise<Email> => {
  try {
    const response = await axios.get(`${API_BASE}/emails/${id}`);
    return response.data;
  } catch (error) {
    console.error('Get email error:', error);
    throw error;
  }
};

export const getSuggestedReply = async (emailId: string): Promise<{ reply: string }> => {
  try {
    const response = await axios.get(`${API_BASE}/emails/${emailId}/suggested-reply`);
    return response.data;
  } catch (error) {
    console.error('Get suggested reply error:', error);
    throw error;
  }
};