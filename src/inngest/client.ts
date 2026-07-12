import { Inngest } from "inngest";

/**
 * Événements Mentio :
 * - "mentio/brand.run"     { brandId }                      → joue le set de prompts d'une marque
 * - "mentio/prompt.run"    { brandId, promptId, promptText, model } → 1 appel LLM
 * - "mentio/run.completed" { promptRunId, brandId }         → à juger
 * - "mentio/run.judged"    { brandId }                      → à re-scorer (debounce)
 */
export const inngest = new Inngest({ id: "mentio" });
