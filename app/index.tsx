import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading label="Starting…" />;
  return <Redirect href={user ? "/(app)/dashboard" : "/(auth)/login"} />;
}
