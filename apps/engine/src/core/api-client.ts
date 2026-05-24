import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
    });

    // Auto-inject API Keys via Interceptor
    this.client.interceptors.request.use(async (config) => {
      if (config.url?.includes('rapidapi.com')) {
        const cred = await prisma.apiCredential.findFirst({
          where: { provider: 'rapidapi', isActive: true }
        });
        if (cred) {
          config.headers['x-rapidapi-key'] = cred.apiKey;
        }
      } else if (config.url?.includes('apify.com')) {
        const cred = await prisma.apiCredential.findFirst({
          where: { provider: 'apify', isActive: true }
        });
        if (cred) {
          config.headers['Authorization'] = `Bearer ${cred.apiKey}`;
        }
      }
      return config;
    });
  }

  async getRapidApi(endpoint: string, params: any) {
    const cred = await prisma.apiCredential.findFirst({ where: { provider: 'rapidapi' } });
    
    // Fallback: If no key is set, simulate a successful API response (Mock Mode)
    if (!cred || !cred.apiKey) {
      console.warn('⚠️ No RapidAPI key found. Using MOCK data mode.');
      return this.generateMockResponse(endpoint, params);
    }

    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  private generateMockResponse(endpoint: string, params: any) {
    if (endpoint.includes('instagram')) {
      return {
        target: params.username,
        follower_count: Math.floor(Math.random() * 1000000),
        following_count: 500,
        biography: "Verified Account",
        is_private: false,
        recent_posts: []
      };
    }
    return { status: 'mock_success', data: 'API Key not provided, returning dummy.' };
  }
}

export const apiClient = new ApiClient();
