"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useCallback } from "react";

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

type UploadMode = "recommendations" | "schedule";

interface ScheduleImportResult {
  success: boolean;
  childId?: string;
  childName?: string;
  gradeLevel?: string;
  diagnosticsCreated?: number;
  weeklyPlansCreated?: number;
  mathSkillsImported?: number;
  elaSkillsImported?: number;
  error?: string;
}

interface QueuedFile {
  name: string;
  content: string;
}

export default function IXLPage() {
  const ixlStatus = useQuery(api.ixlData.getAllChildrenIxlStatus);
  const children = useQuery(api.childProfiles.list);
  const importRecommendations = useMutation(api.ixlData.importFromMarkdown);
  const importSchedule = useMutation(api.ixlData.importScheduleFromMarkdown);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("schedule");
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scheduleResults, setScheduleResults] = useState<ScheduleImportResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".txt")
    );

    if (validFiles.length === 0) {
      setUploadResult({ success: false, message: "Please upload .md or .txt files" });
      return;
    }

    // Read all files
    const readPromises = validFiles.map(
      (file) =>
        new Promise<QueuedFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              name: file.name,
              content: e.target?.result as string,
            });
          };
          reader.readAsText(file);
        })
    );

    Promise.all(readPromises).then((newFiles) => {
      setQueuedFiles((prev) => {
        // Avoid duplicates by name
        const existingNames = new Set(prev.map((f) => f.name));
        const uniqueNew = newFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...uniqueNew];
      });
      setUploadResult(null);
      setScheduleResults([]);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  }, [handleFilesUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const handleProcessAll = async () => {
    if (queuedFiles.length === 0) {
      setUploadResult({ success: false, message: "No files to process" });
      return;
    }

    setIsProcessing(true);
    setUploadResult(null);
    setScheduleResults([]);

    const results: ScheduleImportResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of queuedFiles) {
      setProcessingFile(file.name);
      try {
        if (uploadMode === "schedule") {
          const result = await importSchedule({ markdownContent: file.content });
          results.push(result as ScheduleImportResult);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          const result = await importRecommendations({ markdownContent: file.content });
          results.push({
            success: true,
            childName: `${result.childrenUpdated} children`,
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Failed to process file",
          childName: file.name,
        });
        failCount++;
      }
    }

    setProcessingFile(null);
    setScheduleResults(results);
    setQueuedFiles([]);

    if (failCount === 0) {
      setUploadResult({
        success: true,
        message: `Successfully imported ${successCount} schedule${successCount !== 1 ? "s" : ""}`,
      });
    } else if (successCount === 0) {
      setUploadResult({
        success: false,
        message: `Failed to import ${failCount} file${failCount !== 1 ? "s" : ""}`,
      });
    } else {
      setUploadResult({
        success: true,
        message: `Imported ${successCount} schedule${successCount !== 1 ? "s" : ""}, ${failCount} failed`,
      });
    }

    setIsProcessing(false);
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
          <h1 className="text-2xl font-bold text-gray-900">IXL Progress</h1>
          <p className="text-gray-600">Diagnostic levels and recommendations from IXL</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="btn-primary flex items-center gap-2">
          <span>📤</span>
          {showUpload ? "Hide Upload" : "Import Schedule"}
        </button>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import IXL Data</h2>

          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setUploadMode("schedule")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === "schedule"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}>
                4-Week Schedule
              </button>
              <button
                onClick={() => setUploadMode("recommendations")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === "recommendations"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}>
                Recommendations Only
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              {uploadMode === "schedule" ? (
                <>
                  <p className="text-sm text-blue-800 font-medium mb-2">Upload a 4-Week Lesson Plan:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Upload a schedule file (e.g., &quot;KIRSE - GRADE 1 HOMESCHOOL SCHEDULE.md&quot;)</li>
                    <li>The file should contain: Student Profile, IXL Diagnostic Levels, Weekly Plans</li>
                    <li>Child must already exist in the app (matched by name)</li>
                    <li>Weekly plans will auto-populate the planner for each day</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="text-sm text-blue-800 font-medium mb-2">How to get your recommendations file:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Open Claude Code with Chrome: <code className="bg-blue-100 px-1 rounded">claude</code></li>
                    <li>Navigate to each child&apos;s IXL recommendations page</li>
                    <li>Ask Claude to capture and export recommendations as markdown</li>
                    <li>Upload the generated .md file here</li>
                  </ol>
                </>
              )}
            </div>

            {/* Available Children */}
            {children && children.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 font-medium mb-2">Available children to import for:</p>
                <div className="flex flex-wrap gap-2">
                  {children.map((child) => (
                    <span
                      key={child._id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-full text-sm">
                      <span>{child.avatarEmoji || "👤"}</span>
                      <span>{child.name}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  The child name in the schedule file must match one of these names.
                </p>
              </div>
            )}

            {/* No Children Warning */}
            {children && children.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium">No children found!</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Please <Link href="/children" className="underline">add children</Link> before importing schedules.
                </p>
              </div>
            )}

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}>
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-600 mb-2">
                Drag and drop your schedule files here, or
              </p>
              <label className="btn-secondary cursor-pointer inline-block">
                Browse Files
                <input
                  type="file"
                  accept=".md,.txt"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesUpload(e.target.files);
                    }
                    e.target.value = ""; // Reset to allow re-selecting same files
                  }}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                You can select multiple files at once
              </p>
            </div>

            {/* Queued Files */}
            {queuedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    Files to Import ({queuedFiles.length})
                  </h3>
                  <button
                    onClick={() => setQueuedFiles([])}
                    className="text-sm text-gray-500 hover:text-gray-700">
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {queuedFiles.map((file) => (
                    <div
                      key={file.name}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        processingFile === file.name
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        <span className="text-sm font-medium text-gray-700">
                          {file.name}
                        </span>
                        {processingFile === file.name && (
                          <span className="text-xs text-blue-600">Processing...</span>
                        )}
                      </div>
                      {!isProcessing && (
                        <button
                          onClick={() => removeFile(file.name)}
                          className="text-gray-400 hover:text-gray-600">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleProcessAll}
                  disabled={isProcessing}
                  className="btn-primary w-full disabled:opacity-50">
                  {isProcessing
                    ? `Processing ${processingFile || "..."}`
                    : `Import ${queuedFiles.length} Schedule${queuedFiles.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {/* Result Message */}
            {uploadResult && (
              <div className={`rounded-lg p-4 ${
                uploadResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <p className={`text-sm font-medium ${
                  uploadResult.success ? "text-green-800" : "text-red-800"
                }`}>
                  {uploadResult.success ? "✓ " : "✗ "}{uploadResult.message}
                </p>

                {/* Detailed schedule import results for multiple files */}
                {scheduleResults.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200 space-y-4">
                    {scheduleResults.map((result, index) => (
                      <div key={index} className={`p-3 rounded-lg ${
                        result.success ? "bg-green-100" : "bg-red-100"
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${
                            result.success ? "text-green-800" : "text-red-800"
                          }`}>
                            {result.success ? "✓" : "✗"} {result.childName}
                            {result.gradeLevel && ` (${result.gradeLevel})`}
                          </p>
                          {result.success && result.childId && (
                            <Link
                              href={`/planner/${result.childId}`}
                              className="text-xs text-green-700 hover:text-green-900 font-medium">
                              View Planner &rarr;
                            </Link>
                          )}
                        </div>
                        {result.success ? (
                          <ul className="text-xs text-green-700 mt-1 space-y-0.5">
                            <li>{result.diagnosticsCreated} diagnostics • {result.weeklyPlansCreated} daily plans</li>
                            <li>{result.mathSkillsImported} math skills • {result.elaSkillsImported} ELA skills</li>
                          </ul>
                        ) : (
                          <p className="text-xs text-red-700 mt-1">{result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            Upload a 4-week schedule file to get started with IXL-based lesson plans.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-6 btn-primary">
            Import Schedule
          </button>
        </div>
      )}

      {/* No Data for Children */}
      {ixlStatus && ixlStatus.length > 0 && ixlStatus.every(c => !c.math.diagnosticLevel && !c.ela.diagnosticLevel) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="font-medium text-yellow-800">No diagnostic data imported yet</p>
              <p className="text-sm text-yellow-700 mt-1">
                Click &quot;Upload Recommendations&quot; above to import IXL data from a markdown file.
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
          <p className="text-xs text-gray-400 mt-1">Upload recommendations to see progress</p>
        </div>
      )}
    </div>
  );
}
