import { getMonthlyExpensesLoansReportViaApi } from "./monthly-expenses-report-api";

describe("monthly-expenses-report-api client", () => {
  it("sends x-correlation-id header on GET requests", async () => {
    const fetchImplementation = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          entries: [],
          summary: {
            activeLoanCount: 0,
            payableCurrentMonthAmount: 0,
            receivableCurrentMonthAmount: 0,
            lenderCount: 0,
            monthlyProjection: [],
            netRemainingAmount: 0,
            payableRemainingAmount: 0,
            receivableRemainingAmount: 0,
            remainingAmount: 0,
            trackedLoanCount: 0,
          },
        },
      }),
      ok: true,
    });

    await getMonthlyExpensesLoansReportViaApi(fetchImplementation);

    const options = fetchImplementation.mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const headers = new Headers(options?.headers);

    expect(headers.get("x-correlation-id")).toEqual(expect.any(String));
  });
});
