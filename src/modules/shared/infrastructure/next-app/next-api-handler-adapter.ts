import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { type NextRequest, NextResponse } from "next/server";

type ResponseBody = unknown;

function getHeaderRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function getCookieRecord(request: NextRequest): Record<string, string> {
  return Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  );
}

function getQueryRecord(request: NextRequest): NextApiRequest["query"] {
  const query: NextApiRequest["query"] = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    const currentValue = query[key];

    if (Array.isArray(currentValue)) {
      currentValue.push(value);
      return;
    }

    query[key] = currentValue === undefined ? value : [currentValue, value];
  });

  return query;
}

async function getRequestBody(request: NextRequest): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      return undefined;
    }
  }

  const textBody = await request.text();

  if (!textBody) {
    return undefined;
  }

  try {
    return JSON.parse(textBody) as unknown;
  } catch {
    return textBody;
  }
}

function createLegacyResponse() {
  let statusCode = 200;
  let responseBody: ResponseBody;
  const responseHeaders = new Headers();
  const response = {
    end(body?: ResponseBody) {
      responseBody = body;
      return response;
    },
    getHeader(name: string) {
      return responseHeaders.get(name) ?? undefined;
    },
    json(body: ResponseBody) {
      responseBody = body;
      return response;
    },
    setHeader(name: string, value: number | string | readonly string[]) {
      if (Array.isArray(value)) {
        responseHeaders.set(name, value.join(", "));
        return response;
      }

      responseHeaders.set(name, String(value));
      return response;
    },
    status(nextStatusCode: number) {
      statusCode = nextStatusCode;
      return response;
    },
  } as unknown as NextApiResponse;

  return {
    getResponse() {
      if (responseBody === undefined) {
        return new NextResponse(null, {
          headers: responseHeaders,
          status: statusCode,
        });
      }

      return NextResponse.json(responseBody, {
        headers: responseHeaders,
        status: statusCode,
      });
    },
    response,
  };
}

export function createAppRouteHandler(handler: NextApiHandler) {
  return async function appRouteHandler(request: NextRequest) {
    const body = await getRequestBody(request);
    const headers = getHeaderRecord(request.headers);
    const legacyRequest = {
      body,
      cookies: getCookieRecord(request),
      headers,
      method: request.method,
      query: getQueryRecord(request),
      url: `${request.nextUrl.pathname}${request.nextUrl.search}`,
    } as unknown as NextApiRequest;
    const { getResponse, response } = createLegacyResponse();

    await handler(legacyRequest, response);

    return getResponse();
  };
}
