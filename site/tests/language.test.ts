/** @jest-environment jsdom */
import { LANGUAGE_STORAGE_KEY, resolveLanguage, saveLanguage } from '../src/i18n/language';

beforeEach(() => {
  window.localStorage.clear();
  jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
  jest.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
});

afterEach(() => jest.restoreAllMocks());

test.each(['zh', 'zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant', 'ZH-HK'])(
  'a fresh %s browser selects Chinese without saving a preference',
  (language) => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue([language]);
    expect(resolveLanguage()).toBe('zh');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  }
);

test.each([['en-US', 'zh-CN'], ['fr-FR', 'zh-TW'], ['ja-JP']])(
  'the first browser preference wins: %s',
  (...languages) => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
    expect(resolveLanguage()).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  }
);

test('uses navigator.language when the preferred-language list is empty', () => {
  jest.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
  jest.spyOn(navigator, 'language', 'get').mockReturnValue('zh-TW');
  expect(resolveLanguage()).toBe('zh');
});

test.each(['zh', 'en'] as const)(
  'preserves an existing %s choice over the browser default',
  (lang) => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue([lang === 'zh' ? 'en-US' : 'zh-CN']);
    saveLanguage(lang);
    expect(resolveLanguage()).toBe(lang);
  }
);

test('ignores invalid storage without replacing it with the automatic default', () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'invalid');
  jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
  expect(resolveLanguage()).toBe('zh');
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('invalid');
});

test('uses the browser preference when localStorage access throws', () => {
  jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage is disabled', 'SecurityError');
  });
  jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
  expect(resolveLanguage()).toBe('zh');
  expect(() => saveLanguage('en')).not.toThrow();
});

test('saving a manual choice tolerates a write failure', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  });
  expect(() => saveLanguage('zh')).not.toThrow();
});
