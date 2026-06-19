import { describe, expect, it } from "vitest";

import { redactText } from "../extensions/pi-forge/redaction.js";

describe("redaction", () => {
  it("redacts explicit key value secrets", () => {
    const result = redactText("API_KEY=super-secret-value");

    expect(result.text).toBe("[REDACTED]");
    expect(result.count).toBe(1);
  });

  it("does not redact ordinary prose", () => {
    const result = redactText("Always run npm test before release.");

    expect(result.text).toBe("Always run npm test before release.");
    expect(result.count).toBe(0);
  });

  it("redacts database connection strings", () => {
    const result = redactText(
      "Always use postgres://admin:SecretPass123@prod.db.example.com:5432/app",
    );

    expect(result.text).toBe("Always use [REDACTED]");
    expect(result.count).toBe(1);
  });

  it("redacts AWS access key ids", () => {
    const result = redactText("Set key to AKIAIOSFODNN7EXAMPLE");

    expect(result.text).toBe("Set key to [REDACTED]");
    expect(result.count).toBe(1);
  });

  it("redacts JWT tokens", () => {
    const result = redactText(
      "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.signaturepart123456789012345678901234",
    );

    expect(result.text).toBe("Bearer [REDACTED]");
    expect(result.count).toBe(1);
  });

  it("redacts social security numbers", () => {
    const result = redactText("My SSN is 123-45-6789 and always follow HIPAA");

    expect(result.text).toBe("My SSN is [REDACTED] and always follow HIPAA");
    expect(result.count).toBe(1);
  });

  it("redacts passwords in prose", () => {
    const result = redactText("the password is hunter2 for staging");

    expect(result.text).toBe("[REDACTED] for staging");
    expect(result.count).toBe(1);
  });
});
