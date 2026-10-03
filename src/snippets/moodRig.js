// moodRig.js: mood phrase → three-point lighting rig as validated JSON
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const client = new Anthropic();
const Light = z.object({
  color: z.string(), kelvin: z.number(), intensity: z.number(),
  azimuth: z.number(), elevation: z.number(),
});
const Rig = z.object({
  name: z.string(), key: Light, fill: Light, rim: Light,
  material: z.object({ color: z.string(), metalness: z.number(), roughness: z.number() }),
});

export async function suggestRig(mood) {
  const res = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(Rig) },
    system: 'You are a lighting TD. Turn a mood into a product-render rig. Degrees and hex colours.',
    messages: [{ role: 'user', content: `Mood: ${mood}` }],
  });
  return res.parsed_output;                 // → applied to the extrusion preview
}
