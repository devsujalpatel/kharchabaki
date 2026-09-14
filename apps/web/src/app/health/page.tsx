"use client";

import { healthQuery } from "@/server/health";
import { useQuery } from "@tanstack/react-query";

export default function Health() {
  const { data, error, isPending } = useQuery({
    queryKey: ["healthCheck"],
    queryFn: healthQuery,
  });

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h1>{data.message}</h1>
      <p>Service: {data.data.service}</p>
      <p>Status: {data.data.status}</p>
      <p>Timestamp: {data.data.timestamp}</p>
    </div>
  );
}
