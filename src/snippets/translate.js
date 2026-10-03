// translate.js: one structured LLM call per locale, with per-frame budgets
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const client = new Anthropic();
const LabelCopy = z.object({ descriptor: z.string(), tagline: z.string(), body: z.string() });

export async function translate(master, locale) {
  const res = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(LabelCopy) },
    system:
      'You localise beverage packaging. Keep the brand name AURA untranslated. ' +
      'Prefer the shortest natural phrasing: every field must fit a fixed text frame.',
    messages: [{
      role: 'user',
      content: `Locale: ${locale.code} (${locale.language}). ` +
        'Soft limits: descriptor 32 chars, tagline 26, body 30.\n' + JSON.stringify(master),
    }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`No copy for ${locale.code}`);
  return res.parsed_output;               // → applyCopy() + fitFrame() in Illustrator
}
