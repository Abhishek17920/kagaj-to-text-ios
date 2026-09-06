import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

export default function AuthLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (user) return <Redirect href="/(app)/dashboard" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
