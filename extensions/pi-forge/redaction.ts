export interface RedactionResult {
  text: string;
  count: number;
}

const SECRET_PATTERN_SOURCES: string[] = [
  "-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----",
  "\\b(?:api[_-]?key|token|secret|password|passwd|pwd)\\b\\s*[:=]\\s*[\"']?[^\"'\\s]+[\"']?",
  "\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\\b",
  "\\bsk-[A-Za-z0-9]{20,}\\b",
  "\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b",
  "(?:postgres|postgresql|mysql|mongodb|redis|amqp)://[^\\s\"'<>]+",
  "\\bAKIA[0-9A-Z]{16}\\b",
  "\\beyJ[A-Za-z0-9_-]*\\.eyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]+\\b",
  "\\b(?:DATABASE_URL|REDIS_URL|AMQP_URL|MONGO_URL|CONNECTION_STRING)\\s*=\\s*[^\\s\"'<>]+",
  "\\b\\d{3}-\\d{2}-\\d{4}\\b",
  "\\b(?:the\\s+)?password\\s+is\\s+\\S+",
  "\\bBearer\\s+[A-Za-z0-9._~+/=-]+",
  "\\bAuthorization:\\s*(?:Bearer|token)\\s+[^\\s\"'<>]+",
];

const HIGH_ENTROPY_PATTERN = /\b[A-Za-z0-9_+/=-]{32,}\b/g;

export function redactTurns<T extends { text: string }>(
  turns: T[],
): {
  turns: T[];
  count: number;
} {
  let count = 0;
  const redactedTurns = turns.map((turn) => {
    const result = redactText(turn.text);
    count += result.count;
    return {
      ...turn,
      text: result.text,
    };
  });

  return { turns: redactedTurns, count };
}

export function redactText(text: string): RedactionResult {
  let count = 0;
  let redacted = text;

  for (const source of SECRET_PATTERN_SOURCES) {
    const pattern = new RegExp(source, "gi");
    redacted = redacted.replace(pattern, () => {
      count += 1;
      return "[REDACTED]";
    });
  }

  redacted = redacted.replace(HIGH_ENTROPY_PATTERN, (value) => {
    if (!looksLikeSecret(value)) {
      return value;
    }
    count += 1;
    return "[REDACTED]";
  });

  return { text: redacted, count };
}

function looksLikeSecret(value: string): boolean {
  if (/^[a-f0-9]{32,}$/i.test(value)) {
    return false;
  }

  const hasLetter = /[A-Za-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[_+/=-]/.test(value);
  return hasLetter && hasDigit && (hasSymbol || shannonEntropy(value) >= 4.2);
}

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
