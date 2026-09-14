"use client";

import { authClient } from "@/lib/auth-client";

export default function UserProfile() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p>Loading...</p>;
  }

  if (!session) {
    return <p>Not authenticated</p>;
  }

  return <p>Welcome, {session.user.name}</p>;
}
