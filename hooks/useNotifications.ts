"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// VAPID public key - this should be set in environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type NotificationPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export function useParentNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const subscriptions = useQuery(api.notifications.getParentSubscriptions);
  const subscribeMutation = useMutation(api.notifications.subscribeParent);
  const unsubscribeMutation = useMutation(api.notifications.unsubscribe);

  // Check notification support and permission on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  // Check if already subscribed
  useEffect(() => {
    if (subscriptions && subscriptions.length > 0) {
      setIsSubscribed(true);
    } else {
      setIsSubscribed(false);
    }
  }, [subscriptions]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (permission === "unsupported") {
      console.error("Push notifications not supported");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID public key not configured");
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJson = subscription.toJSON();

      // Save to Convex
      await subscribeMutation({
        subscription: {
          endpoint: subscriptionJson.endpoint!,
          keys: {
            p256dh: subscriptionJson.keys!.p256dh,
            auth: subscriptionJson.keys!.auth,
          },
        },
        deviceName: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to subscribe:", error);
      setIsLoading(false);
      return false;
    }
  }, [permission, subscribeMutation]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await unsubscribeMutation({ endpoint: subscription.endpoint });
        }
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      setIsLoading(false);
      return false;
    }
  }, [unsubscribeMutation]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported: permission !== "unsupported",
  };
}

export function useChildNotifications(childId: Id<"childProfiles"> | null) {
  const [permission, setPermission] = useState<NotificationPermissionState>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const subscriptions = useQuery(
    api.notifications.getChildSubscriptions,
    childId ? { childId } : "skip"
  );
  const subscribeMutation = useMutation(api.notifications.subscribeChild);
  const unsubscribeMutation = useMutation(api.notifications.unsubscribe);

  // Check notification support and permission on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  // Check if already subscribed
  useEffect(() => {
    if (subscriptions && subscriptions.length > 0) {
      setIsSubscribed(true);
    } else {
      setIsSubscribed(false);
    }
  }, [subscriptions]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!childId) return false;

    if (permission === "unsupported") {
      console.error("Push notifications not supported");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID public key not configured");
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJson = subscription.toJSON();

      // Save to Convex
      await subscribeMutation({
        childId,
        subscription: {
          endpoint: subscriptionJson.endpoint!,
          keys: {
            p256dh: subscriptionJson.keys!.p256dh,
            auth: subscriptionJson.keys!.auth,
          },
        },
        deviceName: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to subscribe:", error);
      setIsLoading(false);
      return false;
    }
  }, [childId, permission, subscribeMutation]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await unsubscribeMutation({ endpoint: subscription.endpoint });
        }
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      setIsLoading(false);
      return false;
    }
  }, [unsubscribeMutation]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported: permission !== "unsupported",
  };
}

// Helper to send local notification (for immediate feedback)
export function showLocalNotification(title: string, body: string, url?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: { url },
  });
}
