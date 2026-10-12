import { offlineClient } from "./offline-client";
import { ApiError } from "./offline-engine";
// Preserve the Response interface used by existing mobile services.
export async function api(path: string, init?: RequestInit): Promise<Response> {
  try {
    const result = await offlineClient.request(path, init);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status > 0)
      return new Response(JSON.stringify({ success: false, message: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    throw error;
  }
}
