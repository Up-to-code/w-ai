import { normalizeAuthOrigin } from "@/lib/auth-origin";
import { handler } from "@/lib/auth-server";

export const GET = handler.GET;

export async function POST(request: Request) {
  return handler.POST(await normalizeAuthOrigin(request));
}
