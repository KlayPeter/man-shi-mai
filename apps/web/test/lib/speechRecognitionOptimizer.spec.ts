import { describe, it, expect } from 'vitest';
import { SpeechRecognitionOptimizer } from '../../src/lib/speechRecognitionOptimizer';

describe('SpeechRecognitionOptimizer', () => {
  it('should instantiate successfully with default settings', () => {
    const optimizer = new SpeechRecognitionOptimizer();
    expect(optimizer).toBeDefined();
  });

  describe('optimize', () => {
    it('should return empty string if input is empty', () => {
      const optimizer = new SpeechRecognitionOptimizer();
      expect(optimizer.optimize('')).toBe('');
    });

    it('should remove oral filler words', () => {
      const optimizer = new SpeechRecognitionOptimizer();
      // "嗯就是说我想那个然后呢" -> "我想然后"
      const result = optimizer.optimize('嗯就是说我想那个然后呢');
      expect(result).toBe('我想然后');
    });

    it('should perform homophone corrections', () => {
      const optimizer = new SpeechRecognitionOptimizer();
      // "我写的带吗有函素" -> "我写的代码有函数"
      const result = optimizer.optimize('我写的带吗有函素');
      expect(result).toBe('我写的代码有函数');
    });

    it('should translate spoken technical vocabulary to correct written format', () => {
      const optimizer = new SpeechRecognitionOptimizer();
      // "西加加和爪哇以及皮埃奇皮" -> "C++和Java以及PHP"
      expect(optimizer.optimize('西加加')).toBe('C++');
      expect(optimizer.optimize('爪哇')).toBe('Java');
      expect(optimizer.optimize('皮埃奇皮')).toBe('PHP');
      expect(optimizer.optimize('维优易')).toBe('Vue');
    });

    it('should collapse multiple duplicate characters', () => {
      const optimizer = new SpeechRecognitionOptimizer();
      // "大大大哥好的的的" -> "大哥好的。" (since it ends with '的', smart punctuation appends period)
      const result = optimizer.optimize('大大大哥好的的的');
      expect(result).toBe('大哥好的。');
    });

    describe('Smart Punctuation', () => {
      it('should add question mark for queries', () => {
        const optimizer = new SpeechRecognitionOptimizer();
        expect(optimizer.optimize('为什么')).toBe('为什么？');
        expect(optimizer.optimize('是不是')).toBe('是不是？');
      });

      it('should add period for statements depending on time threshold', () => {
        const optimizer = new SpeechRecognitionOptimizer();
        // Time > 1500ms
        expect(optimizer.optimize('我认为可以', { timeSinceLastFinal: 1600 })).toBe('我认为可以。');
        // Time > 800ms
        expect(optimizer.optimize('我认为可以', { timeSinceLastFinal: 900 })).toBe('我认为可以，');
      });

      it('should add period for words ending with specific indicators', () => {
        const optimizer = new SpeechRecognitionOptimizer();
        expect(optimizer.optimize('好')).toBe('好。');
        expect(optimizer.optimize('完成')).toBe('完成。');
      });
    });
  });
});
