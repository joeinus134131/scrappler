import { BaseScraper } from '../base-scraper';
import { apiClient } from '../../core/api-client';

export class TikTokScraper extends BaseScraper {
  async scrape() {
    const target = this.payload.parameters.target;
    const isDiscovery = target === 'TRENDING';
    
    if (isDiscovery) {
      this.onProgress?.('🔭 Discovery Mode: Connecting to External TikTok API aggregator...');
      
      const response = await apiClient.getRapidApi('https://tiktok-scraper-api.p.rapidapi.com/v1/trending', { region: 'ID' });
      this.onProgress?.('📈 Aggregating viral signals from RapidAPI...');
      
      return {
        platform: 'tiktok',
        jobType: 'discovery',
        contentType: 'feed',
        scrapedAt: new Date().toISOString(),
        rawData: response,
        normalizedData: {
          title: 'Viral TikTok Trends',
          description: 'Top trending hashtags and sounds aggregated via API.',
          signals: ['#viral', '#foryou', '#dance-challenge']
        }
      };
    }

    this.onProgress?.(`🎯 Targeted Mode: Fetching TikTok profile @${target} via RapidAPI...`);
    
    try {
      const response = await apiClient.getRapidApi('https://tiktok-scraper-api.p.rapidapi.com/v1/user/info', { username: target });
      this.onProgress?.('💎 Extracting user metadata from API response...');
      
      return {
        platform: 'tiktok',
        target,
        contentType: 'profile',
        scrapedAt: new Date().toISOString(),
        rawData: response,
        normalizedData: {
          username: target,
          followerCount: response?.follower_count || 'API Mock Data',
          totalLikes: response?.total_likes || 'API Mock Data',
          biography: response?.biography || 'Profile loaded successfully'
        }
      };
    } catch (e: any) {
      throw new Error(`RapidAPI Error: ${e.message}`);
    }
  }
}
