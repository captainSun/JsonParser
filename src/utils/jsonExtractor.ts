import { jsonrepair } from 'jsonrepair';

export interface ExtractedJson {
  raw: string;
  parsed: any;
  startIndex: number;
  endIndex: number;
  isValid: boolean;
}

/**
 * Attempts to extract JSON objects or arrays from a string.
 */
export function extractJson(input: string): ExtractedJson[] {
  const results: ExtractedJson[] = [];
  if (!input) return results;

  const stack: { char: string; index: number }[] = [];
  let inString = false;
  let quoteChar = '';
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (!inString) {
        inString = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push({ char, index: i });
      } else if (char === '}' || char === ']') {
        let matched = false;

        // Pass 1: strict parsing (JSON.parse + collapsed whitespace) on all openers
        for (let j = stack.length - 1; j >= 0 && !matched; j--) {
          const opener = stack[j];
          if ((opener.char === '{' && char === '}') || (opener.char === '[' && char === ']')) {
            const potentialJson = input.substring(opener.index, i + 1);

            try {
              const parsed = JSON.parse(potentialJson);
              results.push({ raw: potentialJson, parsed, startIndex: opener.index, endIndex: i + 1, isValid: true });
              matched = true;
            } catch (e) {
              try {
                const collapsed = potentialJson.replace(/\s{2,}/g, '');
                const parsed = JSON.parse(collapsed);
                results.push({ raw: potentialJson, parsed, startIndex: opener.index, endIndex: i + 1, isValid: true });
                matched = true;
              } catch (e2) {
                // strict parsing failed, will try jsonrepair in pass 2
              }
            }
          }
        }

        // Pass 2: jsonrepair fallback (only if strict parsing failed for all openers)
        if (!matched) {
          for (let j = stack.length - 1; j >= 0; j--) {
            const opener = stack[j];
            if ((opener.char === '{' && char === '}') || (opener.char === '[' && char === ']')) {
              const potentialJson = input.substring(opener.index, i + 1);

              try {
                const repaired = jsonrepair(potentialJson);
                const parsed = JSON.parse(repaired);
                results.push({ raw: potentialJson, parsed, startIndex: opener.index, endIndex: i + 1, isValid: true });
                break;
              } catch (e) {
                try {
                  const collapsed = potentialJson.replace(/\s{2,}/g, '');
                  const repaired = jsonrepair(collapsed);
                  const parsed = JSON.parse(repaired);
                  results.push({ raw: potentialJson, parsed, startIndex: opener.index, endIndex: i + 1, isValid: true });
                  break;
                } catch (e2) {
                  // Not valid yet
                }
              }
            }
          }
        }
      }
    }
  }

  // Filter results to remove nested ones
  const topLevel: ExtractedJson[] = [];
  // Sort by size descending to find largest blocks first
  results.sort((a, b) => (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex));
  
  for (const res of results) {
    const isInside = topLevel.some(tl => res.startIndex >= tl.startIndex && res.endIndex <= tl.endIndex);
    if (!isInside) {
      topLevel.push(res);
    }
  }

  return topLevel.sort((a, b) => a.startIndex - b.startIndex);
}
