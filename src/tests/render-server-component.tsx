import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { render } from "@testing-library/react";

/** Resolves async components through React's server renderer and exposes their body for DOM assertions. */
export async function renderServerComponent(element: ReactNode) {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  const markup = await new Response(stream).text();
  const serverDocument = new DOMParser().parseFromString(markup, "text/html");
  return render(<div dangerouslySetInnerHTML={{ __html: serverDocument.body.innerHTML }} />);
}
