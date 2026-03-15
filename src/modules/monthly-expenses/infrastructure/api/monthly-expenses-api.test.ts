import {
  getMonthlyExpensesDocumentViaApi,
  saveMonthlyExpensesDocumentViaApi,
} from "./monthly-expenses-api";

describe("monthly-expenses-api client", () => {
  it("sends x-correlation-id header on GET requests", async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          items: [],
          month: "2026-03",
        },
      }),
      ok: true,
    });

    await getMonthlyExpensesDocumentViaApi("2026-03", fetchImplementation);

    const options = fetchImplementation.mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const headers = new Headers(options?.headers);

    expect(headers.get("x-correlation-id")).toEqual(expect.any(String));
  });

  it("accepts paymentLink without protocol in POST payloads", async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    await saveMonthlyExpensesDocumentViaApi(
      {
        items: [
          {
            currency: "ARS",
            description: "Electricidad",
            id: "expense-1",
            occurrencesPerMonth: 1,
            paymentLink: "pagos.empresa-energia.com",
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/storage/monthly-expenses",
      expect.objectContaining({
        body: JSON.stringify({
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: "https://pagos.empresa-energia.com",
              subtotal: 45,
            },
          ],
          month: "2026-03",
        }),
        method: "POST",
      }),
    );
  });

  it("rejects invalid paymentLink before sending POST request", async () => {
    const fetchImplementation = jest.fn();

    await expect(
      saveMonthlyExpensesDocumentViaApi(
        {
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: "asdads",
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        fetchImplementation,
      ),
    ).rejects.toThrow();

    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
