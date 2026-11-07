# Translations

Wishporter ships with the following UI languages:

| Code | Language   |
|------|------------|
| `en` | English    |
| `it` | Italian    |
| `fr` | French     |
| `de` | German     |
| `es` | Spanish    |
| `pt` | Portuguese |
| `ru` | Russian    |

The language is detected from the operating system. It can be forced with
`--lang <code>` or the `PAIMON_LANG` environment variable.

## Add a language

1. Copy `en.json` to `<code>.json`, using the ISO 639-1 code (for example
   `pl.json`).
2. Translate the values, **not the keys**.
3. Keep every placeholder between braces exactly as it is: `{error}`, `{file}`,
   `{count}`, etc. They are filled in at runtime.
4. Leave `app_name` as `Wishporter`.
5. Add the code to `SUPPORTED` in `i18n.py`.
6. Run the tests:

   ```bash
   python -m unittest discover -s tests -v
   ```

   The locale tests check key parity, placeholders and empty values.

If a key is missing, Wishporter falls back to English and then to the key name,
so a partial translation will never crash the tool.

## Tips

- Keep the tone friendly and short; these strings appear in a terminal.
- Do not translate protocol values such as `Character Event`, `Wish 2`,
  `Asia`, `Europe`: they are written into the Excel file and read by Paimon.moe.
- Do not add personal data or examples with real UIDs.
