import { describe, it, expect } from 'vitest';
import { generatePageMetadata } from '../../src/utils/seo';
import {
  absoluteUrl,
  generateTitle,
  truncateDescription,
  generateMetaTags,
  SEO,
} from '../../src/constants/seo';

describe('SEO Utilities', () => {
  describe('absoluteUrl', () => {
    it('should return default base URL if path is empty', () => {
      expect(absoluteUrl('')).toBe(SEO.siteUrl);
    });

    it('should return unmodified path if it starts with http:// or https://', () => {
      expect(absoluteUrl('https://example.com/page')).toBe('https://example.com/page');
      expect(absoluteUrl('http://example.com/page')).toBe('http://example.com/page');
    });

    it('should prepend base URL and clean slashes', () => {
      expect(absoluteUrl('/about')).toBe(`${SEO.siteUrl}/about`);
      expect(absoluteUrl('about')).toBe(`${SEO.siteUrl}/about`);
    });
  });

  describe('generateTitle', () => {
    it('should return default title if no page title is provided', () => {
      expect(generateTitle()).toBe(SEO.defaultTitle);
    });

    it('should append suffix if withSuffix is true', () => {
      expect(generateTitle('My Page', true)).toBe(`My Page - ${SEO.siteName}`);
    });

    it('should not append suffix if withSuffix is false', () => {
      expect(generateTitle('My Page', false)).toBe('My Page');
    });
  });

  describe('truncateDescription', () => {
    it('should return default description if empty', () => {
      expect(truncateDescription('')).toBe(SEO.defaultDescription);
    });

    it('should not truncate if description is within limits', () => {
      const shortDesc = 'Hello world';
      expect(truncateDescription(shortDesc)).toBe(shortDesc);
    });

    it('should truncate and add ellipsis if longer than limit', () => {
      const longDesc = 'a'.repeat(200);
      const truncated = truncateDescription(longDesc, 160);
      expect(truncated.length).toBe(160);
      expect(truncated.endsWith('...')).toBe(true);
    });
  });

  describe('generatePageMetadata', () => {
    it('should return default metadata for root pathname', () => {
      const metadata = generatePageMetadata('/');
      expect(metadata.title).toBe('面试麦 - AI智能面试平台 | 在线面试训练与题库');
      expect(metadata.robots).toBe('index,follow');
    });

    it('should return custom metadata options if provided', () => {
      const metadata = generatePageMetadata('/nonexistent', {
        title: 'Custom Title',
        description: 'Custom Desc',
        noIndex: true,
      });

      expect(metadata.title).toBe('Custom Title');
      expect(metadata.description).toBe('Custom Desc');
      expect(metadata.robots).toBe('noindex,nofollow');
    });
  });

  describe('generateMetaTags', () => {
    it('should return array of meta tags containing essential SEO tags', () => {
      const tags = generateMetaTags({
        title: 'My Custom Page Title',
        description: 'Description content',
      });

      expect(tags).toBeInstanceOf(Array);
      expect(tags.some(tag => tag.name === 'description' && tag.content === 'Description content')).toBe(true);
      expect(tags.some(tag => tag.property === 'og:title' && tag.content === 'My Custom Page Title')).toBe(true);
    });
  });
});
