"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

// Format timestamp to readable date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Calculate level as percentage for progress bar
function levelToPercent(level: number): number {
  return Math.round((level / 1300) * 100);
}

// Get color based on level
function getLevelColor(level: number): string {
  const percent = levelToPercent(level);
  if (percent >= 80) return "bg-green-500";
  if (percent >= 60) return "bg-blue-500";
  if (percent >= 40) return "bg-yellow-500";
  return "bg-orange-500";
}

export default function IXLPage() {
  const ixlStatus = useQuery(api.ixlData.getAllChildrenIxlStatus);

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
          <h1 className="text-2xl font-bold text-gray-900">IXL Progress</h1>
          <p className="text-gray-600">Diagnostic levels and recommendations from IXL</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Sync with Claude Code:</span>
          </p>
          <code className="text-xs text-blue-600 block mt-1">
            &quot;Sync IXL recommendations&quot;
          </code>
        </div>
      </div>

      {/* Children IXL Cards */}
      <div className="space-y-6">
        {ixlStatus?.map((child) => (
          <div key={child.childId} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Child Header */}
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{child.avatarEmoji || "👤"}</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{child.childName}</h2>
                  <p className="text-sm text-gray-500">
                    {child.ageGroup === "ages6to9" && "Ages 6-9"}
                    {child.ageGroup === "ages10to13" && "Ages 10-13"}
                    {child.ageGroup === "ages14to16" && "Ages 14-16"}
                  </p>
                </div>
              </div>
            </div>

            {/* Subjects Grid */}
            <div className="p-4 grid gap-4
                            md:grid-cols-2">
              {/* Math */}
              <SubjectCard
                subject="Math"
                emoji="📐"
                diagnosticLevel={child.math.diagnosticLevel}
                lastUpdated={child.math.lastUpdated}
                recommendations={child.math.recommendations}
                syncedToSchedule={child.math.syncedToSchedule}
              />

              {/* Language Arts */}
              <SubjectCard
                subject="Language Arts"
                emoji="📚"
                diagnosticLevel={child.ela.diagnosticLevel}
                lastUpdated={child.ela.lastUpdated}
                recommendations={child.ela.recommendations}
                syncedToSchedule={child.ela.syncedToSchedule}
              />
            </div>

            {/* View Schedule Link */}
            <div className="px-4 py-3 bg-gray-50 border-t">
              <Link
                href={`/planner/${child.childId}`}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View Weekly Schedule &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {(!ixlStatus || ixlStatus.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900">No IXL Data Yet</h2>
          <p className="mt-2 text-gray-600 max-w-md mx-auto">
            Use Claude Code with Chrome integration to sync IXL diagnostic data and recommendations for your children.
          </p>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 max-w-sm mx-auto text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">How to sync:</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Log into IXL in Chrome</li>
              <li>Run <code className="bg-gray-200 px-1 rounded">claude --chrome</code></li>
              <li>Ask: &quot;Sync IXL recommendations&quot;</li>
            </ol>
          </div>
        </div>
      )}

      {/* No Data for Children */}
      {ixlStatus && ixlStatus.length > 0 && ixlStatus.every(c => !c.math.diagnosticLevel && !c.ela.diagnosticLevel) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="font-medium text-yellow-800">No diagnostic data synced yet</p>
              <p className="text-sm text-yellow-700 mt-1">
                Use Claude Code to extract IXL diagnostic levels and recommendations.
                Make sure you&apos;re logged into IXL with parent account access to all children.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subject Card Component
function SubjectCard({
  subject,
  emoji,
  diagnosticLevel,
  lastUpdated,
  recommendations,
  syncedToSchedule,
}: {
  subject: string;
  emoji: string;
  diagnosticLevel?: number;
  lastUpdated?: number;
  recommendations: number;
  syncedToSchedule: boolean;
}) {
  const hasData = diagnosticLevel !== undefined;

  return (
    <div className={`border rounded-lg p-4 ${hasData ? "border-gray-200" : "border-dashed border-gray-300 bg-gray-50"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-medium text-gray-900">{subject}</h3>
      </div>

      {hasData ? (
        <>
          {/* Diagnostic Level */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-600">Diagnostic Level</span>
              <span className="text-lg font-semibold text-gray-900">
                {diagnosticLevel}
                <span className="text-sm text-gray-500 font-normal">/1300</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getLevelColor(diagnosticLevel)}`}
                style={{ width: `${levelToPercent(diagnosticLevel)}%` }}
              />
            </div>
          </div>

          {/* Recommendations */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {recommendations} recommendation{recommendations !== 1 ? "s" : ""}
            </span>
            {syncedToSchedule ? (
              <span className="inline-flex items-center gap-1 text-green-600">
                <span>✓</span> Synced
              </span>
            ) : recommendations > 0 ? (
              <span className="text-yellow-600">Not synced</span>
            ) : null}
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-2">
              Updated {formatDate(lastUpdated)}
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No data yet</p>
          <p className="text-xs text-gray-400 mt-1">Sync from IXL to see progress</p>
        </div>
      )}
    </div>
  );
}
