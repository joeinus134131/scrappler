// Simple Sentiment Analyzer (Expandable to LLM)
import Sentiment from 'sentiment';

const analyzer = new Sentiment();

export class AIAgent {
  static analyzeSentiment(text: string) {
    if (!text) return { label: 'neutral', score: 0 };

    const result = analyzer.analyze(text);
    
    let label = 'neutral';
    if (result.score > 1) label = 'positive';
    if (result.score < -1) label = 'negative';

    return {
      label,
      score: result.comparative
    };
  }
}
