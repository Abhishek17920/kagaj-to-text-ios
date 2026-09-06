import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";
import { C } from "@/lib/theme";

export default function AppLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.ink,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: "Notebooks" }} />
      <Stack.Screen name="new" options={{ title: "New notebook", presentation: "modal" }} />
      <Stack.Screen name="account" options={{ title: "Account" }} />
      <Stack.Screen name="notebook/[id]" options={{ title: "" }} />
      <Stack.Screen name="workspace/[id]" options={{ title: "Split view" }} />
      <Stack.Screen name="pdf/[id]" options={{ title: "PDF" }} />
      <Stack.Screen name="chat/index" options={{ title: "Chat" }} />
      <Stack.Screen name="chat/thread" options={{ title: "" }} />
    </Stack>
  );
}
