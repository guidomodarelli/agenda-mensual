import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LenderOption } from "@/components/monthly-expenses/lender-picker";

import { LenderCreateDialog } from "./lender-create-dialog";

describe("LenderCreateDialog", () => {
  it("does not show required-name validation after a successful save clears form values", async () => {
    const user = userEvent.setup();

    function LenderCreateDialogHarness() {
      const [formValues, setFormValues] = useState<{
        name: string;
        notes: string;
        type: LenderOption["type"];
      }>({
        name: "Prestador temporal",
        notes: "",
        type: "family",
      });

      return (
        <LenderCreateDialog
          feedbackMessage={null}
          feedbackTone="default"
          formValues={formValues}
          isOpen={true}
          isSubmitting={false}
          onDiscardUnsavedChanges={jest.fn()}
          onFieldChange={jest.fn()}
          onOpenChange={jest.fn()}
          onSubmit={async () => {
            setFormValues({
              name: "",
              notes: "",
              type: "family",
            });

            return true;
          }}
        />
      );
    }

    render(<LenderCreateDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Guardar prestador" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Completá el nombre del prestador antes de guardarlo."),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Nombre")).not.toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
  });
});
