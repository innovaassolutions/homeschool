"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Id } from "@/convex/_generated/dataModel";

// Subject display info
const SUBJECT_INFO: Record<string, { emoji: string; name: string; color: string }> = {
  math: { emoji: "📐", name: "Math", color: "text-blue-600" },
  ela: { emoji: "📚", name: "Language Arts", color: "text-purple-600" },
  science: { emoji: "🔬", name: "Science", color: "text-green-600" },
  history: { emoji: "🏛️", name: "History", color: "text-amber-600" },
};

// Check if child is "active" (heartbeat within last 60 seconds)
const ACTIVE_THRESHOLD_MS = 60 * 1000;

type ActivityStatus = "active" | "away" | "completed" | "not_started" | "no_schedule";

function getActivityStatus(
  lastSeen: number | undefined,
  overallStatus: string,
  hasSchedule: boolean
): ActivityStatus {
  if (!hasSchedule) return "no_schedule";
  if (overallStatus === "completed") return "completed";
  if (overallStatus === "not_started") return "not_started";

  // Child is in_progress - check lastSeen
  if (lastSeen) {
    const timeSinceLastSeen = Date.now() - lastSeen;
    if (timeSinceLastSeen < ACTIVE_THRESHOLD_MS) {
      return "active";
    }
    return "away";
  }

  return "away";
}

export default function StatusPage() {
  const childrenProgress = useQuery(api.dailyProgress.getAllChildrenTodayProgress);
  const recentNotifications = useQuery(api.notifications.getRecentNotifications, { limit: 10 });
  const resetCurrentBlock = useMutation(api.dailyProgress.resetCurrentBlock);

  const [resettingChildId, setResettingChildId] = useState<Id<"childProfiles"> | null>(null);

  // Force re-render every 10 seconds to update activity status
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResetTimer = async (childId: Id<"childProfiles">) => {
    setResettingChildId(childId);
    try {
      await resetCurrentBlock({ childId });
    } finally {
      setResettingChildId(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4
                      sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Status</h1>
          <p className="text-gray-600">Real-time progress for all children</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Children progress cards */}
      <div className="grid gap-6
                      lg:grid-cols-2">
        {childrenProgress?.map((child) => {
          const progressPercent = child.totalBlocks > 0 ? Math.round((child.completedCount / child.totalBlocks) * 100) : 0;

          const activityStatus = getActivityStatus(
            child.lastSeen,
            child.overallStatus,
            child.hasSchedule
          );

          const isActive = activityStatus === "active";
          const isAway = activityStatus === "away";
          const isCompleted = activityStatus === "completed";
          const notStarted = activityStatus === "not_started";
          const noSchedule = activityStatus === "no_schedule";

          // Format last seen time
          const lastSeenText = child.lastSeen
            ? (() => {
                const diffMs = Date.now() - child.lastSeen;
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 1) return "Just now";
                if (diffMins === 1) return "1 min ago";
                if (diffMins < 60) return `${diffMins} mins ago`;
                return formatTime(child.lastSeen);
              })()
            : null;

          // Get current block info for display
          const currentBlockInfo = child.currentBlock
            ? SUBJECT_INFO[child.currentBlock.subject ?? ""] || {
                emoji: child.currentBlock.type === "break" ? "☕" : "📖",
                name: child.currentBlock.type === "break" ? "Break" : child.currentBlock.subject || "Activity",
                color: "text-gray-600",
              }
            : null;

          return (
            <div
              key={child.childId}
              className={`bg-white rounded-lg shadow overflow-hidden ${
                isActive ? "ring-2 ring-green-500" : isAway ? "ring-2 ring-yellow-500" : ""
              }`}>
              {/* Header */}
              <div className={`p-4 ${
                isCompleted
                  ? "bg-green-50"
                  : isActive
                  ? "bg-green-50"
                  : isAway
                  ? "bg-yellow-50"
                  : "bg-gray-50"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{child.childAvatarEmoji}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{child.childName}</h2>
                      <p className="text-sm text-gray-500">
                        {child.childAgeGroup === "ages6to9" && "Ages 6-9"}
                        {child.childAgeGroup === "ages10to13" && "Ages 10-13"}
                        {child.childAgeGroup === "ages14to16" && "Ages 14-16"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        <span>🏆</span> Done!
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Active
                      </span>
                    )}
                    {isAway && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Away
                      </span>
                    )}
                    {notStarted && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                        Not started
                      </span>
                    )}
                    {noSchedule && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        No schedule
                      </span>
                    )}
                  </div>
                </div>

                {/* Current activity display when active/away */}
                {(isActive || isAway) && currentBlockInfo && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{currentBlockInfo.emoji}</span>
                        <span className={`font-medium ${currentBlockInfo.color}`}>
                          {child.currentBlock?.type === "break"
                            ? `Break time (${child.currentBlock?.durationMinutes}m)`
                            : `Working on ${currentBlockInfo.name}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {lastSeenText && (
                          <span className="text-xs text-gray-500">
                            Last seen: {lastSeenText}
                          </span>
                        )}
                        <button
                          onClick={() => handleResetTimer(child.childId)}
                          disabled={resettingChildId === child.childId}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg
                                     hover:bg-gray-300 transition-colors disabled:opacity-50"
                          title="Reset timer to full duration">
                          {resettingChildId === child.childId ? "..." : "🔄 Reset"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {child.totalBlocks > 0 && (
                <div className="px-4 py-2 bg-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>{child.completedCount} of {child.totalBlocks} activities</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isCompleted ? "bg-green-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Session times */}
              {(child.startedAt || child.completedAt) && (
                <div className="px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
                  {child.startedAt && (
                    <span>Started: {formatTime(child.startedAt)}</span>
                  )}
                  {child.completedAt && (
                    <span>Completed: {formatTime(child.completedAt)}</span>
                  )}
                </div>
              )}

              {/* No schedule message */}
              {!child.hasSchedule && (
                <div className="p-4 text-center">
                  <p className="text-gray-500 text-sm">No activities scheduled for today</p>
                  <Link
                    href={`/planner/${child.childId}`}
                    className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium inline-block">
                    Create a schedule &rarr;
                  </Link>
                </div>
              )}

              {/* Footer with link to planner */}
              {child.hasSchedule && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <Link
                    href={`/planner/${child.childId}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View/Edit Schedule &rarr;
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {(!childrenProgress || childrenProgress.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
          <h2 className="text-xl font-semibold text-gray-900">No children yet</h2>
          <p className="mt-2 text-gray-600">
            Add children from your dashboard to track their progress.
          </p>
          <Link href="/dashboard" className="mt-4 btn-primary inline-block">
            Go to Dashboard
          </Link>
        </div>
      )}

      {/* Recent activity */}
      {recentNotifications && recentNotifications.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {recentNotifications.map((notification) => (
              <div key={notification._id} className="p-4 flex items-start gap-3">
                <span className="text-xl">
                  {notification.type === "day_completed"
                    ? "🏆"
                    : notification.type === "task_completed"
                    ? "✅"
                    : notification.type === "break_started"
                    ? "☕"
                    : "📖"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-500">{notification.body}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatTime(notification.sentAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
