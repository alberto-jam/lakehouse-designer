import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import fc from "fast-check";
import Formulario from "../Formulario";

/**
 * Feature: lakehouse-designer-frontend, Property 6: Validação do formulário rejeita entrada inválida
 *
 * Para qualquer estado do formulário onde pelo menos um campo numérico contém valor ≤ 0
 * ou pelo menos um campo obrigatório está vazio, a submissão do formulário deve ser impedida
 * e nenhuma chamada à API deve ser realizada.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe("Formulario - Property 6: Validação do formulário rejeita entrada inválida", () => {
  /**
   * Helper to find an input by its associated label text.
   * Since the component doesn't use htmlFor, we find the label element
   * and then get the sibling input within the same parent div.
   */
  function getInputByLabel(container: HTMLElement, labelText: string): HTMLInputElement {
    const labels = container.querySelectorAll("label");
    for (const label of labels) {
      if (label.textContent?.trim() === labelText) {
        const parent = label.parentElement;
        if (parent) {
          const input = parent.querySelector("input, select");
          if (input) return input as HTMLInputElement;
        }
      }
    }
    throw new Error(`Input not found for label: ${labelText}`);
  }

  /**
   * Arbitrary that generates an invalid value for a numeric field:
   * either empty string, zero, or a negative number.
   */
  const invalidNumericValueArb = fc.oneof(
    fc.constant(""),
    fc.constant("0"),
    fc.integer({ min: -1000, max: -1 }).map(String),
    fc.double({ min: -1000, max: 0, noNaN: true, noDefaultInfinity: true }).map(String)
  );

  /**
   * Arbitrary that generates a valid positive numeric value.
   */
  const validNumericValueArb = fc
    .double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true })
    .map((n) => n.toFixed(2));

  /**
   * Arbitrary that generates a form state where at least one numeric field is invalid.
   * Each field is either valid (positive number) or invalid (empty/zero/negative).
   * We filter to ensure at least one field is invalid.
   */
  const invalidFormStateArb = fc
    .tuple(
      fc.oneof(invalidNumericValueArb, validNumericValueArb),
      fc.oneof(invalidNumericValueArb, validNumericValueArb),
      fc.oneof(invalidNumericValueArb, validNumericValueArb),
      fc.oneof(invalidNumericValueArb, validNumericValueArb),
      fc.constantFrom("low", "medium", "high")
    )
    .filter(([dataVol, records, latency, users]) => {
      // At least one numeric field must be invalid (empty or ≤ 0)
      const isInvalid = (val: string) =>
        val.trim() === "" || Number(val) <= 0 || isNaN(Number(val));
      return (
        isInvalid(dataVol) ||
        isInvalid(records) ||
        isInvalid(latency) ||
        isInvalid(users)
      );
    });

  it("should prevent form submission when at least one numeric field is invalid (empty or ≤ 0)", () => {
    fc.assert(
      fc.property(invalidFormStateArb, ([dataVol, records, latency, users, complexity]) => {
        const onSubmit = vi.fn();
        const { container, unmount } = render(
          <Formulario onSubmit={onSubmit} loading={false} />
        );

        // Fill in the numeric fields
        const dataVolInput = getInputByLabel(container, "Volume de Dados (TB)");
        const recordsInput = getInputByLabel(container, "Registros por Dia (milhões)");
        const latencyInput = getInputByLabel(container, "Latência Máxima (segundos)");
        const usersInput = getInputByLabel(container, "Usuários Simultâneos");
        const complexitySelect = getInputByLabel(container, "Complexidade de Consulta");

        fireEvent.change(dataVolInput, { target: { value: dataVol } });
        fireEvent.change(recordsInput, { target: { value: records } });
        fireEvent.change(latencyInput, { target: { value: latency } });
        fireEvent.change(usersInput, { target: { value: users } });
        fireEvent.change(complexitySelect, { target: { value: complexity } });

        // Attempt to submit the form
        const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
        fireEvent.click(submitButton);

        // onSubmit should NOT have been called because at least one field is invalid
        expect(onSubmit).not.toHaveBeenCalled();

        // Cleanup to avoid DOM pollution between iterations
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
