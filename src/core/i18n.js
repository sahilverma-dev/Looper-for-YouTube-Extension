/*
 * i18n — loads `_locales/<locale>/messages.json` (keys prefixed `script_`).
 * English is always loaded as a fallback.
 */

/** Map a YouTube language tag to the locale folder we ship. */
export function mapLocale(lang) {
  const key = String(lang || '').replace(/-/g, '_');
  switch (key) {
    case 'fr_CA':
      return 'fr';
    case 'pt':
    case 'pt_PT':
      return 'pt_BR';
    case 'zh_Hans_CN':
      return 'zh_CN';
    case 'zh_Hant_HK':
      return 'zh_HK';
    case 'zh_Hant_TW':
      return 'zh_TW';
    case 'en_GB':
    case 'en_US':
      return 'en';
    case 'id_ID':
      return 'id';
    default:
      return key;
  }
}

export class I18n {
  /**
   * @param {string} baseUrl chrome-extension://<id>/ (from sessionStorage.chromePage)
   */
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || '';
    this.maps = {};
    this.lang = 'en';
  }

  async load(lang) {
    this.lang = mapLocale(lang) || 'en';
    const locales = this.lang === 'en' ? ['en'] : ['en', this.lang];
    await Promise.all(
      locales.map(async (locale) => {
        if (this.maps[locale] && Object.keys(this.maps[locale]).length) return;
        this.maps[locale] = await this.#fetchLocale(locale);
      }),
    );
    return this;
  }

  async #fetchLocale(locale) {
    if (!this.baseUrl) return {};
    try {
      const res = await fetch(`${this.baseUrl}_locales/${locale}/messages.json`);
      if (!res.ok) return {};
      const data = await res.json();
      const out = {};
      for (const [name, entry] of Object.entries(data || {})) {
        const match = /^script_(.+)$/.exec(name);
        if (match && entry && entry.message != null) out[match[1]] = entry.message;
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Translate a key, falling back to English, then to the key itself. */
  t(key) {
    const current = this.maps[this.lang] || {};
    if (key in current) return current[key];
    const en = this.maps.en || {};
    if (key in en) return en[key];
    return '';
  }
}
