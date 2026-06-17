import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { getMonthlyExpensesLoansReport } from "./get-monthly-expenses-loans-report";

describe("getMonthlyExpensesLoansReport", () => {
  it("aggregates the latest loan snapshot by lender", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Tarjeta visa",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-12",
                installmentCount: 12,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 2,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-02",
        },
        {
          items: [
            {
              currency: "ARS",
              description: "Tarjeta visa",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-12",
                installmentCount: 12,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 3,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
              total: 50000,
            },
          ],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-03",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result).toEqual({
      entries: [
        {
          activeLoanCount: 1,
          activeLoans: [
            {
              currency: "ARS",
              description: "Tarjeta visa",
              endMonth: "2026-12",
              installmentCount: 12,
              isDueSoon: false,
              paidInstallments: 3,
              remainingAmount: 450000,
              remainingAmountOriginal: null,
            },
          ],
          direction: "payable",
          firstDebtMonth: "2026-01",
          lenderId: "lender-1",
          lenderName: "Papa",
          lenderType: "family",
          latestRecordedMonth: "2026-03",
          remainingAmount: 450000,
          trackedLoanCount: 1,
        },
      ],
      summary: {
        activeLoanCount: 1,
        lenderCount: 1,
        netRemainingAmount: 450000,
        payableRemainingAmount: 450000,
        receivableRemainingAmount: 0,
        remainingAmount: 450000,
        trackedLoanCount: 1,
      },
    });
  });

  it("uses the latest loan direction when an existing loan is corrected", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo corregido",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
          month: "2026-02",
        },
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo corregido",
              id: "expense-1",
              loan: {
                direction: "receivable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 2,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-03",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toEqual([
      {
        activeLoanCount: 1,
        activeLoans: [
          {
            currency: "ARS",
            description: "Prestamo corregido",
            endMonth: "2026-04",
            installmentCount: 4,
            isDueSoon: true,
            paidInstallments: 2,
            remainingAmount: 20000,
            remainingAmountOriginal: null,
          },
        ],
        direction: "receivable",
        firstDebtMonth: "2026-01",
        lenderId: "lender-1",
        lenderName: "Papa",
        lenderType: "family",
        latestRecordedMonth: "2026-03",
        remainingAmount: 20000,
        trackedLoanCount: 1,
      },
    ]);
    expect(result.summary).toEqual({
      activeLoanCount: 1,
      lenderCount: 1,
      netRemainingAmount: -20000,
      payableRemainingAmount: 0,
      receivableRemainingAmount: 20000,
      remainingAmount: 20000,
      trackedLoanCount: 1,
    });
  });

  it("separates payable and receivable remaining amounts", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo recibido",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
            {
              currency: "ARS",
              description: "Prestamo realizado",
              id: "expense-2",
              loan: {
                direction: "receivable",
                endMonth: "2026-03",
                installmentCount: 3,
                lenderId: "lender-2",
                lenderName: "Cliente",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 5000,
              total: 5000,
            },
          ],
          month: "2026-01",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-01",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
        {
          id: "lender-2",
          name: "Cliente",
          type: "other",
        },
      ],
      repository,
    });

    expect(result.summary).toEqual({
      activeLoanCount: 2,
      lenderCount: 2,
      netRemainingAmount: 20000,
      payableRemainingAmount: 30000,
      receivableRemainingAmount: 10000,
      remainingAmount: 40000,
      trackedLoanCount: 2,
    });
    expect(result.entries.map((entry) => entry.direction)).toEqual([
      "payable",
      "receivable",
    ]);
  });

  it("keeps loans with matching details and different directions separated", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo corregido",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
            {
              currency: "ARS",
              description: "Prestamo corregido",
              id: "expense-2",
              loan: {
                direction: "receivable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
          ],
          month: "2026-02",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-02",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toEqual([
      {
        activeLoanCount: 1,
        activeLoans: [
          {
            currency: "ARS",
            description: "Prestamo corregido",
            endMonth: "2026-04",
            installmentCount: 4,
            isDueSoon: false,
            paidInstallments: 1,
            remainingAmount: 30000,
            remainingAmountOriginal: null,
          },
        ],
        direction: "payable",
        firstDebtMonth: "2026-01",
        lenderId: "lender-1",
        lenderName: "Papa",
        lenderType: "family",
        latestRecordedMonth: "2026-02",
        remainingAmount: 30000,
        trackedLoanCount: 1,
      },
      {
        activeLoanCount: 1,
        activeLoans: [
          {
            currency: "ARS",
            description: "Prestamo corregido",
            endMonth: "2026-04",
            installmentCount: 4,
            isDueSoon: false,
            paidInstallments: 1,
            remainingAmount: 30000,
            remainingAmountOriginal: null,
          },
        ],
        direction: "receivable",
        firstDebtMonth: "2026-01",
        lenderId: "lender-1",
        lenderName: "Papa",
        lenderType: "family",
        latestRecordedMonth: "2026-02",
        remainingAmount: 30000,
        trackedLoanCount: 1,
      },
    ]);
    expect(result.summary).toEqual({
      activeLoanCount: 2,
      lenderCount: 1,
      netRemainingAmount: 0,
      payableRemainingAmount: 30000,
      receivableRemainingAmount: 30000,
      remainingAmount: 60000,
      trackedLoanCount: 2,
    });
  });

  it("counts unique lenders in summary even when they have loans in both directions", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo recibido",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-04",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
            {
              currency: "ARS",
              description: "Prestamo otorgado",
              id: "expense-2",
              loan: {
                direction: "receivable",
                endMonth: "2026-03",
                installmentCount: 3,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 5000,
              total: 5000,
            },
          ],
          month: "2026-01",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-01",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toHaveLength(2);
    expect(result.summary.lenderCount).toBe(1);
  });

  it("excludes fully paid loans from a lender's associated expenses while keeping active ones", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Tarjeta",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-06",
                installmentCount: 6,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 1,
                startMonth: "2026-01",
              },
              occurrencesPerMonth: 1,
              subtotal: 10000,
              total: 10000,
            },
            {
              currency: "ARS",
              description: "Aire Acondicionado",
              id: "expense-2",
              loan: {
                direction: "payable",
                endMonth: "2025-09",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 4,
                startMonth: "2025-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 20000,
              total: 20000,
            },
          ],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-03",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toEqual([
      {
        activeLoanCount: 1,
        activeLoans: [
          {
            currency: "ARS",
            description: "Tarjeta",
            endMonth: "2026-06",
            installmentCount: 6,
            isDueSoon: false,
            paidInstallments: 1,
            remainingAmount: 50000,
            remainingAmountOriginal: null,
          },
        ],
        direction: "payable",
        firstDebtMonth: "2026-01",
        lenderId: "lender-1",
        lenderName: "Papa",
        lenderType: "family",
        latestRecordedMonth: "2026-03",
        remainingAmount: 50000,
        trackedLoanCount: 2,
      },
    ]);
    expect(result.summary).toEqual({
      activeLoanCount: 1,
      lenderCount: 1,
      netRemainingAmount: 50000,
      payableRemainingAmount: 50000,
      receivableRemainingAmount: 0,
      remainingAmount: 50000,
      trackedLoanCount: 2,
    });
  });

  it("omits lenders whose loans are all fully paid", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Aire Acondicionado",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2025-09",
                installmentCount: 4,
                lenderId: "lender-1",
                lenderName: "Papa",
                paidInstallments: 4,
                startMonth: "2025-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 20000,
              total: 20000,
            },
          ],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-03",
      lenders: [
        {
          id: "lender-1",
          name: "Papa",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toEqual([]);
    expect(result.summary).toEqual({
      activeLoanCount: 0,
      lenderCount: 0,
      netRemainingAmount: 0,
      payableRemainingAmount: 0,
      receivableRemainingAmount: 0,
      remainingAmount: 0,
      trackedLoanCount: 0,
    });
  });

  it("treats a loan as settled once the current month is past its end month, even if its last snapshot still shows a pending installment", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Aire Acondicionado",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2026-04",
                installmentCount: 18,
                lenderId: "lender-1",
                lenderName: "Adrian",
                paidInstallments: 17,
                startMonth: "2024-11",
              },
              occurrencesPerMonth: 1,
              subtotal: 57944.33,
              total: 57944.33,
            },
          ],
          month: "2026-03",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-06",
      lenders: [
        {
          id: "lender-1",
          name: "Adrian",
          type: "family",
        },
      ],
      repository,
    });

    expect(result.entries).toEqual([]);
    expect(result.summary.activeLoanCount).toBe(0);
    expect(result.summary.remainingAmount).toBe(0);
  });

  it("converts USD loans to ARS using the document solidarity rate", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          exchangeRateSnapshot: {
            blueRate: 1100,
            month: "2026-06",
            officialRate: 950,
            solidarityRate: 1000,
          },
          items: [
            {
              currency: "USD",
              description: "Iphone",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2027-10",
                installmentCount: 17,
                lenderId: "lender-1",
                lenderName: "Camila",
                paidInstallments: 0,
                startMonth: "2026-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-06",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-06",
      lenders: [
        {
          id: "lender-1",
          name: "Camila",
          type: "other",
        },
      ],
      repository,
    });

    expect(result.entries[0]?.remainingAmount).toBe(1700000);
    expect(result.entries[0]?.activeLoans[0]?.remainingAmountOriginal).toBe(1700);
    expect(result.entries[0]?.activeLoans[0]?.currency).toBe("USD");
    expect(result.summary.payableRemainingAmount).toBe(1700000);
  });

  it("converts USD loans using the latest available rate when their own document has none", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          exchangeRateSnapshot: {
            blueRate: 900,
            month: "2026-04",
            officialRate: 750,
            solidarityRate: 800,
          },
          items: [],
          month: "2026-04",
        },
        {
          items: [
            {
              currency: "USD",
              description: "Iphone",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2027-10",
                installmentCount: 17,
                lenderId: "lender-1",
                lenderName: "Camila",
                paidInstallments: 0,
                startMonth: "2026-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-06",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-06",
      lenders: [
        {
          id: "lender-1",
          name: "Camila",
          type: "other",
        },
      ],
      repository,
    });

    expect(result.entries[0]?.remainingAmount).toBe(1360000);
  });

  it("lists each active loan separately even when they share a description", async () => {
    const repository: MonthlyExpensesRepository = {
      getByMonth: jest.fn(),
      listAll: jest.fn().mockResolvedValue([
        {
          items: [
            {
              currency: "ARS",
              description: "Iphone",
              id: "expense-1",
              loan: {
                direction: "payable",
                endMonth: "2027-10",
                installmentCount: 17,
                lenderId: "lender-1",
                lenderName: "Camila",
                paidInstallments: 0,
                startMonth: "2026-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
            {
              currency: "ARS",
              description: "Iphone",
              id: "expense-2",
              loan: {
                direction: "payable",
                endMonth: "2027-03",
                installmentCount: 10,
                lenderId: "lender-1",
                lenderName: "Camila",
                paidInstallments: 0,
                startMonth: "2026-06",
              },
              occurrencesPerMonth: 1,
              subtotal: 100,
              total: 100,
            },
          ],
          month: "2026-06",
        },
      ]),
      save: jest.fn(),
    };

    const result = await getMonthlyExpensesLoansReport({
      currentMonth: "2026-06",
      lenders: [
        {
          id: "lender-1",
          name: "Camila",
          type: "other",
        },
      ],
      repository,
    });

    expect(result.entries[0]?.activeLoanCount).toBe(2);
    expect(
      result.entries[0]?.activeLoans.map((loan) => loan.description),
    ).toEqual(["Iphone", "Iphone"]);
    expect(
      result.entries[0]?.activeLoans.map((loan) => loan.remainingAmount),
    ).toEqual([1700, 1000]);
  });

  it("returns an empty report when the repository does not implement listAll", async () => {
    const result = await getMonthlyExpensesLoansReport({
      lenders: [],
      repository: {
        getByMonth: jest.fn(),
        save: jest.fn(),
      } as unknown as MonthlyExpensesRepository,
    });

    expect(result).toEqual({
      entries: [],
      summary: {
        activeLoanCount: 0,
        lenderCount: 0,
        netRemainingAmount: 0,
        payableRemainingAmount: 0,
        receivableRemainingAmount: 0,
        remainingAmount: 0,
        trackedLoanCount: 0,
      },
    });
  });
});
