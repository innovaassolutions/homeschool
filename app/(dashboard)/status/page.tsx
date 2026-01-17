"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

// Subject display info
const SUBJECT_INFO: Record<string, { emoji: string; name: string }> = {
  math: { emoji: "📐", name: "Math" },
  ela: { emoji: "📚", name: "Language Arts" },
  science: { emoji: "🔬", name: "Science" },
  history: { emoji: "🏛️", name: "History" },
};

export default function StatusPage() {
  const childrenProgress = useQuery(api.dailyProgress.getAllChildrenTodayProgress);
  const recentNotifications = useQuery(api.notifications.getRecentNotifications, { limit: 10 });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
          const completedBlocks = child.blocks?.filter(
            (b) => b.status === "completed"
          ).length ?? 0;
          const totalBlocks = child.blocks?.length ?? 0;
          const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

          const isActive = child.overallStatus === "in_progress";
          const isCompleted = child.overallStatus === "completed";
          const notStarted = child.overallStatus === "not_started";

          return (
            <div
              key={child.childId}
              className={`bg-white rounded-lg shadow overflow-hidden ${
                isActive ? "ring-2 ring-blue-500" : ""
              }`}>
              {/* Header */}
              <div className={`p-4 ${
                isCompleted
                  ? "bg-green-50"
                  : isActive
                  ? "bg-blue-50"
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
                        <span>✓</span> Done!
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium animate-pulse">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Active
                      </span>
                    )}
                    {notStarted && totalBlocks > 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                        Not started
                      </span>
                    )}
                    {totalBlocks === 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        No schedule
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {totalBlocks > 0 && (
                <div className="px-4 py-2 bg-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>{completedBlocks} of {totalBlocks} activities</span>
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

              {/* Block list */}
              {child.blocks && child.blocks.length > 0 && (
                <div className="p-4">
                  <div className="space-y-2">
                    {child.blocks.map((block, index) => {
                      // Get block details from weekly plan if available
                      const subjectInfo = SUBJECT_INFO[block.blockId.split("-")[0]] || {
                        emoji: block.status === "completed" ? "✓" : "⏳",
                        name: `Block ${index + 1}`,
                      };

                      return (
                        <div
                          key={block.blockId}
                          className={`flex items-center gap-3 p-2 rounded-lg ${
                            block.status === "completed"
                              ? "bg-green-50"
                              : block.status === "in_progress"
                              ? "bg-blue-50"
                              : block.status === "skipped"
                              ? "bg-gray-100"
                              : "bg-white"
                          }`}>
                          <span className="text-xl">
                            {block.status === "completed"
                              ? "✅"
                              : block.status === "in_progress"
                              ? "▶️"
                              : block.status === "skipped"
                              ? "⏭️"
                              : "⬜"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              block.status === "completed" ? "text-green-700" :
                              block.status === "in_progress" ? "text-blue-700" :
                              "text-gray-600"
                            }`}>
                              {subjectInfo.name}
                            </p>
                            {block.startedAt && (
                              <p className="text-xs text-gray-400">
                                Started at {formatTime(block.startedAt)}
                                {block.completedAt && ` - Completed at ${formatTime(block.completedAt)}`}
                              </p>
                            )}
                          </div>
                          {block.actualDurationMinutes !== undefined && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(block.actualDurationMinutes)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No schedule message */}
              {(!child.blocks || child.blocks.length === 0) && (
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
              {child.blocks && child.blocks.length > 0 && (
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
