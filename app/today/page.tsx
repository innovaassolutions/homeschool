"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useChildNotifications } from "@/hooks/useNotifications";

// IXL subject URLs
const IXL_URLS: Record<string, string> = {
  math: "https://www.ixl.com/diagnostic/arena?subject=math",
  ela: "https://www.ixl.com/diagnostic/arena?subject=ela",
};

// Subject display info
const SUBJECT_INFO: Record<string, { emoji: string; name: string; color: string }> = {
  math: { emoji: "📐", name: "Math", color: "bg-blue-500" },
  ela: { emoji: "📚", name: "Language Arts", color: "bg-purple-500" },
  science: { emoji: "🔬", name: "Science", color: "bg-green-500" },
  history: { emoji: "🏛️", name: "History", color: "bg-amber-500" },
};

type ChildSession = {
  childId: Id<"childProfiles">;
  name: string;
  ageGroup: string;
  avatarEmoji?: string;
  familyId: Id<"families">;
  loginTime: number;
};

export default function TodayPage() {
  const router = useRouter();
  const [childSession, setChildSession] = useState<ChildSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Notification hook
  const notifications = useChildNotifications(childSession?.childId ?? null);

  // Load child session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("childSession");
    if (stored) {
      setChildSession(JSON.parse(stored));
    } else {
      router.push("/child-login");
    }
  }, [router]);

  // Show notification prompt if not subscribed
  useEffect(() => {
    if (childSession && notifications.isSupported && !notifications.isSubscribed && notifications.permission === "prompt") {
      // Check if we've already asked this session
      const prompted = sessionStorage.getItem("notificationPrompted");
      if (!prompted) {
        setShowNotificationPrompt(true);
      }
    }
  }, [childSession, notifications.isSupported, notifications.isSubscribed, notifications.permission]);

  // Query today's schedule with progress
  const todayData = useQuery(
    api.dailyProgress.getTodayWithPlan,
    childSession ? { childId: childSession.childId } : "skip"
  );

  // Mutations
  const initializeToday = useMutation(api.dailyProgress.initializeToday);
  const startBlock = useMutation(api.dailyProgress.startBlock);
  const completeBlock = useMutation(api.dailyProgress.completeBlock);
  const heartbeat = useMutation(api.dailyProgress.heartbeat);

  // Heartbeat - update lastSeen every 30 seconds so parents can see activity
  useEffect(() => {
    if (!childSession) return;

    // Send initial heartbeat
    heartbeat({ childId: childSession.childId });

    // Send heartbeat every 30 seconds
    const interval = setInterval(() => {
      heartbeat({ childId: childSession.childId });
    }, 30000);

    return () => clearInterval(interval);
  }, [childSession, heartbeat]);

  // Get current block
  const currentBlockIndex = todayData?.progress?.currentBlockIndex ?? 0;
  const currentBlock = todayData?.blocks?.[currentBlockIndex];
  const allBlocks = todayData?.blocks ?? [];

  // Initialize today's progress when schedule loads
  useEffect(() => {
    if (todayData?.hasSchedule && !todayData.progress && childSession) {
      initializeToday({ childId: childSession.childId });
    }
  }, [todayData, childSession, initializeToday]);

  // Timer logic
  useEffect(() => {
    if (!isTimerRunning || timeRemaining === null) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle starting a lesson
  const handleStartLesson = useCallback(async () => {
    if (!childSession || !currentBlock) return;

    await startBlock({
      childId: childSession.childId,
      blockId: currentBlock.id,
    });

    // Set timer
    setTimeRemaining(currentBlock.durationMinutes * 60);
    setIsTimerRunning(true);

    // Open IXL in new tab if it's a lesson
    if (currentBlock.type === "lesson" && currentBlock.resource?.url) {
      window.open(currentBlock.resource.url, "_blank");
    } else if (currentBlock.type === "lesson" && currentBlock.subject) {
      const url = IXL_URLS[currentBlock.subject] || IXL_URLS.math;
      window.open(url, "_blank");
    }
  }, [childSession, currentBlock, startBlock]);

  // Handle completing a block
  const handleComplete = useCallback(async () => {
    if (!childSession || !currentBlock) return;

    setIsTimerRunning(false);
    setTimeRemaining(null);

    const result = await completeBlock({
      childId: childSession.childId,
      blockId: currentBlock.id,
    });

    // If there's a next block, set up for it
    if (!result.allCompleted && result.nextBlockIndex >= 0) {
      // Timer will be set when they click Start on the next block
    }
  }, [childSession, currentBlock, completeBlock]);

  // Handle resetting timer (for interruptions)
  const handleResetTimer = useCallback(() => {
    if (!currentBlock) return;
    setTimeRemaining(currentBlock.durationMinutes * 60);
    setIsTimerRunning(true);
  }, [currentBlock]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("childSession");
    router.push("/child-login");
  };

  // Calculate progress dots
  const completedCount = allBlocks.filter(
    (b) => b.status === "completed" || b.status === "skipped"
  ).length;

  // Loading state
  if (!childSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // No schedule state
  if (todayData && !todayData.hasSchedule) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <span className="text-6xl">{childSession.avatarEmoji || "🎉"}</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">
            No lessons today, {childSession.name}!
          </h1>
          <p className="text-gray-600 mt-2">
            Enjoy your day off! Check back tomorrow.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 text-gray-500 hover:text-gray-700">
            Log out
          </button>
        </div>
      </div>
    );
  }

  // All done state
  if (todayData?.progress?.overallStatus === "completed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="text-8xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-gray-900">ALL DONE!</h1>
          <p className="text-xl text-gray-600 mt-2">
            Amazing work today, {childSession.name}!
          </p>
          <p className="text-gray-500 mt-4">
            You completed {completedCount} activities
          </p>
          <div className="flex justify-center gap-1 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="text-3xl">⭐</span>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="mt-8 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold
                       hover:bg-blue-600 transition-colors">
            Done for Today
          </button>
        </div>
      </div>
    );
  }

  // Get subject info for current block
  const subjectInfo = currentBlock?.subject
    ? SUBJECT_INFO[currentBlock.subject] || { emoji: "📖", name: currentBlock.subject, color: "bg-gray-500" }
    : { emoji: "☕", name: "Break", color: "bg-green-500" };

  // Handle notification enable
  const handleEnableNotifications = async () => {
    sessionStorage.setItem("notificationPrompted", "true");
    setShowNotificationPrompt(false);
    await notifications.subscribe();
  };

  const handleDismissNotifications = () => {
    sessionStorage.setItem("notificationPrompted", "true");
    setShowNotificationPrompt(false);
  };

  // Active learning view
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex flex-col">
      {/* Notification prompt */}
      {showNotificationPrompt && (
        <div className="bg-blue-600 text-white px-4 py-3">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔔</span>
              <span className="text-sm">Get reminders when breaks end?</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1 bg-white text-blue-600 rounded-lg text-sm font-medium
                           hover:bg-blue-50 transition-colors">
                Yes!
              </button>
              <button
                onClick={handleDismissNotifications}
                className="px-3 py-1 text-blue-200 hover:text-white text-sm">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{childSession.avatarEmoji || "👤"}</span>
          <span className="font-medium text-gray-700">{childSession.name}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-gray-700 text-sm">
          Log out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          {/* Break view */}
          {currentBlock?.type === "break" ? (
            <div className="text-center space-y-6">
              <div className="text-8xl">🎉</div>
              <h1 className="text-3xl font-bold text-gray-900">BREAK TIME!</h1>
              <p className="text-gray-600">
                Great job! Take a {currentBlock.durationMinutes} minute break.
              </p>

              {/* Timer */}
              {timeRemaining !== null && (
                <div className="text-5xl font-mono font-bold text-green-600">
                  {formatTime(timeRemaining)}
                </div>
              )}

              {currentBlock.status === "pending" && (
                <button
                  onClick={handleStartLesson}
                  className="w-full py-4 bg-green-500 text-white text-xl font-semibold rounded-xl
                             hover:bg-green-600 transition-colors">
                  Start Break
                </button>
              )}

              {currentBlock.status === "in_progress" && (
                <div className="space-y-3">
                  <button
                    onClick={handleComplete}
                    className="w-full py-4 bg-blue-500 text-white text-xl font-semibold rounded-xl
                               hover:bg-blue-600 transition-colors">
                    Break Done!
                  </button>
                  <button
                    onClick={handleResetTimer}
                    className="w-full py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-xl
                               hover:bg-gray-300 transition-colors flex items-center justify-center gap-2">
                    🔄 Reset Timer
                  </button>
                </div>
              )}

              <p className="text-sm text-gray-500">
                Next up: {allBlocks[currentBlockIndex + 1]?.subject
                  ? SUBJECT_INFO[allBlocks[currentBlockIndex + 1]?.subject as string]?.name || allBlocks[currentBlockIndex + 1]?.subject
                  : "Nothing"}
              </p>
            </div>
          ) : (
            /* Lesson view */
            <div className="text-center space-y-6">
              <div className="text-8xl">{subjectInfo.emoji}</div>
              <h1 className="text-3xl font-bold text-gray-900">{subjectInfo.name}</h1>
              <p className="text-gray-600">
                {currentBlock?.instructions || `Work on your IXL ${subjectInfo.name} recommendations`}
              </p>

              {/* Timer */}
              {timeRemaining !== null && (
                <div className="text-5xl font-mono font-bold text-blue-600">
                  {formatTime(timeRemaining)}
                </div>
              )}

              {/* Not started */}
              {currentBlock?.status === "pending" && (
                <button
                  onClick={handleStartLesson}
                  className="w-full py-4 bg-blue-500 text-white text-xl font-semibold rounded-xl
                             hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                  🚀 START LESSON
                </button>
              )}

              {/* In progress */}
              {currentBlock?.status === "in_progress" && (
                <div className="space-y-3">
                  <button
                    onClick={handleComplete}
                    className="w-full py-4 bg-green-500 text-white text-xl font-semibold rounded-xl
                               hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                    ✓ I'M DONE
                  </button>
                  <button
                    onClick={handleResetTimer}
                    className="w-full py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-xl
                               hover:bg-gray-300 transition-colors flex items-center justify-center gap-2">
                    🔄 Reset Timer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Progress footer */}
      <footer className="p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center gap-2 mb-2">
            {allBlocks.map((block, i) => (
              <div
                key={block.id}
                className={`w-4 h-4 rounded-full transition-colors ${
                  block.status === "completed"
                    ? "bg-green-500"
                    : block.status === "skipped"
                    ? "bg-gray-400"
                    : block.status === "in_progress"
                    ? "bg-blue-500 animate-pulse"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            {completedCount} of {allBlocks.length} activities complete
          </p>
        </div>
      </footer>
    </div>
  );
}
