import { render, screen } from "@testing-library/react";

import Loading from "@/app/loading";

describe("App Router loading", () => {
  it("renders an accessible section loading status", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando sección...");
  });
});
