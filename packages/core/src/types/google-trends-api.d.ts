declare module "google-trends-api" {
  export interface DailyTrendsObject {
    default: {
      trendingSearchesDays: Array<{
        date: string;
        formattedDate: string;
        trendingSearches: Array<{
          title: {
            query: string;
            exploreLink: string;
          };
          formattedTraffic: string;
          relatedQueries: Array<{ query: string; exploreLink: string }>;
          image: { newsUrl: string; source: string; imageUrl: string };
          articles: Array<{ title: string; timeAgo: string; source: string; image: { newsUrl: string; source: string; imageUrl: string }; url: string; snippet: string }>;
          shareUrl: string;
        }>;
      }>;
      endDateForNextRequest: string;
      rssFeedPageUrl: string;
    };
  }
  
  export interface DailyTrendsOptions {
    trendDate?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
  }
  
  export interface RelatedQueriesObject {
    default: {
      rankedList: Array<{
        rankedKeyword: Array<{
          query: string;
          value: number;
        }>;
      }>;
    };
  }

  export interface RelatedQueriesOptions {
    keyword: string | string[];
    geo?: string;
    hl?: string;
    timezone?: number;
    startTime?: Date;
    endTime?: Date;
  }

  export function dailyTrends(options: DailyTrendsOptions | string): Promise<string>;
  export function relatedQueries(options: RelatedQueriesOptions): Promise<string>;
}
