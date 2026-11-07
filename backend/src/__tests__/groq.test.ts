import { describe, it, expect } from 'vitest';
import { extractJson } from '../services/groq.service';

describe('extractJson (malformed LLM output handling)', () => {
  it('parses plain JSON', () => expect(extractJson('{"a":1}')).toEqual({ a: 1 }));
  it('strips markdown fences', () => expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  it('ignores prose around the object', () => expect(extractJson('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } }));
  it('throws on text without JSON', () => expect(() => extractJson('sorry, no')).toThrow());
  it('throws on truncated JSON', () => expect(() => extractJson('{"a": [1,2')).toThrow());
});
