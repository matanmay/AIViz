// Global in-memory cache for rendered PlantUML image URLs
const plantUmlUrlCache = new Map();

/**
 * Ensures code is clean PlantUML syntax enclosed with @startuml ... @enduml
 * and strips any markdown backticks if present.
 */
export function normalizePlantUML(code) {
  if (!code) return '';
  let trimmed = code.trim();

  // Remove markdown code fences if wrapped
  trimmed = trimmed.replace(/^```(?:plantuml|puml)?\s*/i, '').replace(/```\s*$/, '').trim();

  if (!trimmed.startsWith('@startuml')) {
    trimmed = '@startuml\n' + trimmed;
  }
  if (!trimmed.endsWith('@enduml')) {
    trimmed = trimmed + '\n@enduml';
  }
  return trimmed;
}

/**
 * Helper to generate Kroki GET URL with browser-native deflate compression.
 * GET requests on <img> elements have zero CORS restrictions.
 */
export async function getKrokiUrl(rawCode) {
  const code = normalizePlantUML(rawCode);
  const cacheKey = code.trim();

  if (!cacheKey) return null;
  if (plantUmlUrlCache.has(cacheKey)) {
    return plantUmlUrlCache.get(cacheKey);
  }

  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([new TextEncoder().encode(code)]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
      const buffer = await new Response(compressedStream).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const url = `https://kroki.io/plantuml/svg/${base64}`;
      plantUmlUrlCache.set(cacheKey, url);
      return url;
    }
  } catch (err) {
    console.warn('PlantUML Kroki CompressionStream error:', err);
  }
  return null;
}
