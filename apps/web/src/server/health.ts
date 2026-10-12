type Data = {
  service: string;
  status: string;
  timestamp: string;
};

type Health = {
  success: boolean;
  message: string;
  data: Data;
};

export async function healthQuery(): Promise<Health> {
  const response = await fetch("/api/v1/health", { cache: "no-store" });
  if (!response.ok) throw new Error("Service is unavailable");
  return response.json();
}
