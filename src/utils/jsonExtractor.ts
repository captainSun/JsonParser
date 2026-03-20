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
        // Find the matching opener
        for (let j = stack.length - 1; j >= 0; j--) {
          const opener = stack[j];
          if ((opener.char === '{' && char === '}') || (opener.char === '[' && char === ']')) {
            const potentialJson = input.substring(opener.index, i + 1);
            
            try {
              // Try standard JSON first
              const parsed = JSON.parse(potentialJson);
              results.push({
                raw: potentialJson,
                parsed,
                startIndex: opener.index,
                endIndex: i + 1,
                isValid: true
              });
              break; 
            } catch (e) {
              try {
                const repaired = jsonrepair(potentialJson);
                const parsed = JSON.parse(repaired);
                results.push({
                  raw: potentialJson,
                  parsed,
                  startIndex: opener.index,
                  endIndex: i + 1,
                  isValid: true
                });
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
