import { describe, expect, it } from 'vitest';
import {
  buildChatGptModelSearchTerms,
  findMatchingChatGptModelOption,
  normalizeChatGptModelText,
} from './shared.js';

describe('normalizeChatGptModelText', () => {
  it('normalizes punctuation-heavy model names', () => {
    expect(normalizeChatGptModelText('GPT-5.4 Pro')).toBe('gpt 5 4 pro');
  });
});

describe('buildChatGptModelSearchTerms', () => {
  it('expands pro aliases', () => {
    expect(buildChatGptModelSearchTerms('gpt-5-pro')).toEqual(
      expect.arrayContaining(['pro', 'gpt 5 pro', 'research grade']),
    );
  });
});

describe('findMatchingChatGptModelOption', () => {
  const options = [
    { title: 'Auto', description: 'Decides how long to think' },
    { title: 'Instant', description: 'Answers right away' },
    { title: 'Thinking', description: 'Thinks longer for better answers' },
    { title: 'Pro', description: 'Research-grade intelligence' },
    { title: 'Legacy models' },
  ];

  it('matches the Pro button from common aliases', () => {
    expect(findMatchingChatGptModelOption(options, 'pro')?.title).toBe('Pro');
    expect(findMatchingChatGptModelOption(options, 'research-grade')?.title).toBe('Pro');
    expect(findMatchingChatGptModelOption(options, 'gpt-5-pro')?.title).toBe('Pro');
  });

  it('matches the legacy bucket from a short alias', () => {
    expect(findMatchingChatGptModelOption(options, 'legacy')?.title).toBe('Legacy models');
  });

  it('matches thinking from a full model-style label', () => {
    expect(findMatchingChatGptModelOption(options, '5.4 thinking')?.title).toBe('Thinking');
  });
});
