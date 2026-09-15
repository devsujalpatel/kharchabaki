"use client";

import { useSession } from "@/hooks/use-session";

export default function UserProfile() {
  const { data: session, isPending, isError } = useSession();

  if (isPending) {
    return <p>Loading...</p>;
  }

  if (isError || !session) {
    return <p>Not authenticated</p>;
  }

  return <p>Welcome, {session.user.name}</p>;
}
