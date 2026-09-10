import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StoragePlayground } from "./storage-playground";

describe("StoragePlayground", () => {
  it("does not render internal storage content", () => {
    const { container } = render(<StoragePlayground />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByText("Guardar configuración")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardar archivo del usuario")).not.toBeInTheDocument();
  });
});
