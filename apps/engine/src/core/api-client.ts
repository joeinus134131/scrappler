import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
    });

    // Auto-inject API Keys via Interceptor
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('rapidapi.com')) {
        const cred = await prisma.apiCredential.findFirst({
          where: { provider: 'rapidapi', isActive: true }
        });
        if (cred) {
          config.headers['x-rapidapi-key'] = cred.apiKey;
          try {
            const url = new URL(config.url);
            config.headers['x-rapidapi-host'] = url.hostname;
          } catch (e) {
            // ignore invalid urls
          }
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
      const followers = Math.floor(Math.random() * 1000000) + 10000;
      return {
        target: params.username,
        follower_count: followers,
        following_count: Math.floor(Math.random() * 1000) + 100,
        biography: "Digital Creator | Traveling the world 🌍 | Tech Enthusiast 💻",
        is_private: false,
        profile_pic_url: "https://i.pravatar.cc/300",
        engagement_rate: (Math.random() * 5 + 1).toFixed(2) + "%",
        average_likes: Math.floor(followers * 0.05),
        recent_posts: Array.from({ length: 15 }).map((_, i) => ({
          id: `post_${i}`,
          caption: `Exploring the unseen beauty. #travel #lifestyle #day${i}`,
          likes: Math.floor(followers * 0.05 * (Math.random() * 0.5 + 0.8)),
          comments: Math.floor(Math.random() * 500) + 10,
          posted_at: new Date(Date.now() - i * 86400000).toISOString(),
          type: ['image', 'video', 'carousel'][Math.floor(Math.random() * 3)],
        })),
        sentiment: 'Positive'
      };
    }
    return { status: 'mock_success', data: 'API Key not provided, returning dummy.' };
  }
}

export const apiClient = new ApiClient();
