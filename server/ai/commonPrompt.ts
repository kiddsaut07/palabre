import { AIAnalysisResult } from '../../src/types';

export const COMMON_SYSTEM_INSTRUCTION = `You are PALABRE's Cultural Intelligence Engine.
PALABRE is an oral history quest system where users walk outside into their neighborhood, interview real human beings, and bring back their spoken voices to preserve living community memory (starting in Yaoundé, Cameroon and extending globally).

Your task:
Analyze the submitted conversation or story strictly and truthfully.

STRICT RULES:
1. TRUTHFULNESS & GROUNDING:
   - Distinguish DIRECTLY HEARD from INFERRED.
   - Do NOT invent proverbs, names, dates, ethnic groups, or traditions not spoken in the story.
   - If spoken content is unclear, write "The recording was unclear" or use "[inaudible]".
   - Never hallucinate quotes or facts.

2. TRANSCRIPT:
   - Provide or preserve what the speaker actually said in their language or vernacular (French, English, Pidgin, Camfranglais, or local dialect).
   - Preserve natural cadence and wording. Do not turn informal community speech into sterile corporate prose.

3. THEME:
   - Exactly one concise theme keyword (e.g., "wisdom", "patience", "craft", "memory", "family", "community", "food", "language", "migration", "courage", "work", "childhood", "tradition", "legacy").

4. EXTRACTED:
   - The core nugget: the specific proverb, memory, life advice, or traditional practice shared.

5. SUMMARY:
   - Exactly 1 to 2 concise sentences summarizing the conversation.

6. CULTURAL SIGNIFICANCE:
   - 1 to 2 sentences explaining why this oral testimony matters for community continuity.
   - Use cautious, humble phrasing (e.g. "This story captures a neighborhood perspective on...", "This preserves a personal family transmission of..."). Avoid sweeping unsupported anthropological claims.

7. NEXT MISSION:
   - Design a real-world follow-up mission DIRECTLY inspired by what was just heard.
   - MUST require the explorer to put their phone down and go outside to talk to another real human.
   - MUST contain a concrete action and a meaningful question.
   - Under 50 words.
   - Must NOT ask for internet research or AI usage.

OUTPUT FORMAT:
Return strict JSON matching this schema:
{
  "transcript": "string",
  "theme": "string",
  "extracted": "string",
  "summary": "string",
  "culturalSignificance": "string",
  "nextMission": "string"
}`;

export function buildPromptText(missionText: string, missionNumber: number, transcript?: string, previousContext?: string): string {
  let prompt = `Analyze this oral testimony for PALABRE Mission #${missionNumber}.\n\nCURRENT MISSION:\n"${missionText}"\n`;

  if (previousContext) {
    prompt += `\nPREVIOUS MISSION CONTEXT:\n"${previousContext}"\n`;
  }

  if (transcript) {
    prompt += `\nIMPORTANT SOURCE NOTE:\nYou are analyzing a text transcript produced by a separate speech-to-text system.\nYou did NOT hear the original audio directly. Do not invent acoustic details, voice inflections, or background sounds unless explicitly described in the words spoken.\nDistinguish strictly between what is directly stated, what is inferred, and what remains unknown.\n\nSPOKEN TRANSCRIPT:\n"${transcript}"\n`;
  } else {
    prompt += `\nListen carefully to the audio, transcribe the speaker faithfully, and extract the cultural knowledge.\n`;
  }

  prompt += `\nExtract the core wisdom, determine the theme, explain its cultural significance, and craft the next physical mission based on this story. Output ONLY valid JSON matching the schema.`;

  return prompt;
}

/**
 * Robustly parses and validates LLM output JSON, handling markdown codeblocks,
 * trailing text, or slight schema variations.
 */
export function sanitizeAndValidateAIOutput(rawOutput: string, fallbackMission: string, providedTranscript?: string): AIAnalysisResult {
  if (!rawOutput || typeof rawOutput !== 'string') {
    throw new Error('LLM returned an empty response.');
  }

  let cleaned = rawOutput.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Find the outermost JSON object bounds if there is surrounding commentary
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse LLM JSON output: ${(err as Error).message}`);
  }

  // Normalize transcript
  let transcript = typeof parsed.transcript === 'string' && parsed.transcript.trim()
    ? parsed.transcript.trim()
    : providedTranscript || 'The speaker shared their perspective during the mission.';

  // Normalize theme
  let theme = typeof parsed.theme === 'string' && parsed.theme.trim()
    ? parsed.theme.trim().toLowerCase()
    : 'wisdom';

  // Normalize extracted
  let extracted = '';
  if (typeof parsed.extracted === 'string' && parsed.extracted.trim()) {
    extracted = parsed.extracted.trim();
  } else if (Array.isArray(parsed.extracted)) {
    extracted = parsed.extracted.join('; ').trim();
  } else {
    extracted = 'A reminder that patience and attentive listening ground community relations.';
  }

  // Normalize summary
  let summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : 'An authentic neighborhood reflection captured during the quest.';

  // Normalize cultural significance
  let culturalSignificance = typeof parsed.culturalSignificance === 'string' && parsed.culturalSignificance.trim()
    ? parsed.culturalSignificance.trim()
    : 'This oral testimony preserves a personal lesson that deepens local neighborhood memory.';

  // Normalize next mission
  let nextMission = typeof parsed.nextMission === 'string' && parsed.nextMission.trim()
    ? parsed.nextMission.trim()
    : `Find someone who has practiced this same value for over ten years. Ask them what was the hardest moment to keep it.`;

  return {
    transcript,
    theme,
    extracted,
    summary,
    culturalSignificance,
    nextMission,
  };
}
