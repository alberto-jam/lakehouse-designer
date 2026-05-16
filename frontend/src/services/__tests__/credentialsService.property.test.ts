import fc from "fast-check";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveCredentials,
  getCredentials,
  clearCredentials,
} from "../credentialsService";

describe("credentialsService - Property-Based Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Feature: lakehouse-designer-frontend, Property 1: Round-trip de credenciais
   * **Validates: Requirements 1.2**
   *
   * Para quaisquer 3 strings não-vazias e não compostas apenas de espaços,
   * saveCredentials seguido de getCredentials deve retornar os mesmos valores.
   */
  it("should round-trip credentials through save/get for any non-empty strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (accessKeyId, secretAccessKey, sessionToken) => {
          clearCredentials();
          const creds = { accessKeyId, secretAccessKey, sessionToken };
          const result = saveCredentials(creds);
          expect(result).toBe(true);
          const retrieved = getCredentials();
          expect(retrieved).toEqual(creds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: lakehouse-designer-frontend, Property 2: Rejeição de credenciais vazias ou whitespace
   * **Validates: Requirements 1.5**
   *
   * Para qualquer conjunto de 3 strings onde pelo menos uma é vazia ou composta
   * apenas de espaços em branco, saveCredentials deve retornar false e o conteúdo
   * do localStorage deve permanecer inalterado.
   */
  it("should reject credentials and not modify localStorage when at least one field is empty or whitespace-only", () => {
    // Arbitrary for a string that is empty or whitespace-only
    const emptyOrWhitespace = fc.oneof(
      fc.constant(""),
      fc.stringOf(fc.constant(" "), { minLength: 1, maxLength: 10 })
    );

    // Arbitrary for any string (could be valid or invalid)
    const anyString = fc.string({ minLength: 0, maxLength: 50 });

    // Generate 3 strings where at least one is empty/whitespace
    const credsWithAtLeastOneEmpty = fc
      .tuple(anyString, anyString, anyString, fc.integer({ min: 0, max: 2 }))
      .map(([s1, s2, s3, idx]) => {
        // Force at least one field to be empty/whitespace
        const strings = [s1, s2, s3];
        return { strings, forceIdx: idx };
      })
      .chain(({ strings, forceIdx }) =>
        emptyOrWhitespace.map((emptyVal) => {
          const result = [...strings];
          result[forceIdx] = emptyVal;
          return {
            accessKeyId: result[0],
            secretAccessKey: result[1],
            sessionToken: result[2],
          };
        })
      );

    fc.assert(
      fc.property(credsWithAtLeastOneEmpty, (creds) => {
        // Capture localStorage state before the call
        const before = localStorage.getItem("lakehouse_aws_credentials");

        const result = saveCredentials(creds);

        // saveCredentials must return false
        expect(result).toBe(false);

        // localStorage must remain unchanged
        const after = localStorage.getItem("lakehouse_aws_credentials");
        expect(after).toBe(before);
      }),
      { numRuns: 100 }
    );
  });
});
