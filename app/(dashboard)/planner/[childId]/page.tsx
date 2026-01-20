"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

// Day names for display
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Subject options
const SUBJECTS = [
  { id: "math", name: "Math", emoji: "📐" },
  { id: "ela", name: "Language Arts", emoji: "📚" },
  { id: "science", name: "Science", emoji: "🔬" },
  { id: "history", name: "History", emoji: "🏛️" },
];

// IXL URLs for subjects
const IXL_URLS: Record<string, string> = {
  math: "https://www.ixl.com/diagnostic/arena?subject=math",
  ela: "https://www.ixl.com/diagnostic/arena?subject=ela",
};

type Block = {
  id: string;
  order: number;
  type: "lesson" | "break";
  subject?: string;
  mode?: "recommendations" | "strand_focus" | "specific_skill";
  strand?: string;
  resource?: {
    platform: string;
    name: string;
    url: string;
  };
  durationMinutes: number;
  instructions?: string;
};

type BlockFormData = Omit<Block, "id" | "order">;

export default function PlannerPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as Id<"childProfiles">;

  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Queries
  const child = useQuery(api.childProfiles.get, { id: childId });
  const weeklyPlans = useQuery(api.weeklyPlans.getByChild, { childId });
  const dayPlan = weeklyPlans?.find((p) => p.dayOfWeek === selectedDay);

  // Get today's date info for progress display
  const today = new Date();
  const todayDayOfWeek = today.getDay();
  const todayDateString = today.toISOString().split("T")[0];
  const isSelectedDayToday = selectedDay === todayDayOfWeek;

  // Query today's progress (only meaningful if viewing today's schedule)
  const todayProgress = useQuery(
    api.dailyProgress.getByChildAndDate,
    isSelectedDayToday ? { childId, date: todayDateString } : "skip"
  );

  // Helper to get block status from progress
  const getBlockStatus = (blockId: string): "pending" | "in_progress" | "completed" | "skipped" | null => {
    if (!isSelectedDayToday || !todayProgress) return null;
    const progressBlock = todayProgress.blocks?.find((b) => b.blockId === blockId);
    return progressBlock?.status ?? "pending";
  };

  // Mutations
  const upsertPlan = useMutation(api.weeklyPlans.upsert);
  const removeBlock = useMutation(api.weeklyPlans.removeBlock);
  const copyDay = useMutation(api.weeklyPlans.copyDay);

  // Get blocks for current day, sorted by order
  const currentBlocks = (dayPlan?.blocks ?? []).sort((a, b) => a.order - b.order);

  // Calculate total duration
  const totalMinutes = currentBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Handle adding a new block
  const handleAddBlock = useCallback(async (data: BlockFormData) => {
    const newBlock: Block = {
      ...data,
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      order: currentBlocks.length,
    };

    await upsertPlan({
      childId,
      dayOfWeek: selectedDay,
      blocks: [...currentBlocks, newBlock],
    });

    setShowBlockModal(false);
    setEditingBlock(null);
  }, [childId, currentBlocks, selectedDay, upsertPlan]);

  // Handle editing a block
  const handleEditBlock = useCallback(async (data: BlockFormData) => {
    if (!editingBlock) return;

    const updatedBlocks = currentBlocks.map((b) =>
      b.id === editingBlock.id
        ? { ...b, ...data }
        : b
    );

    await upsertPlan({
      childId,
      dayOfWeek: selectedDay,
      blocks: updatedBlocks,
    });

    setShowBlockModal(false);
    setEditingBlock(null);
  }, [childId, currentBlocks, editingBlock, selectedDay, upsertPlan]);

  // Handle removing a block
  const handleRemoveBlock = useCallback(async (blockId: string) => {
    if (!dayPlan) return;
    await removeBlock({ planId: dayPlan._id, blockId });
  }, [dayPlan, removeBlock]);

  // Handle copying day
  const handleCopyDay = useCallback(async (toDayOfWeek: number) => {
    await copyDay({
      childId,
      fromDayOfWeek: selectedDay,
      toDayOfWeek,
    });
    setShowCopyModal(false);
  }, [childId, copyDay, selectedDay]);

  // Handle copying FROM Monday TO current day
  const handleCopyFromMonday = useCallback(async () => {
    await copyDay({
      childId,
      fromDayOfWeek: 1, // Monday
      toDayOfWeek: selectedDay,
    });
  }, [childId, copyDay, selectedDay]);

  // Handle moving blocks up/down
  const handleMoveBlock = useCallback(async (blockId: string, direction: "up" | "down") => {
    const blockIndex = currentBlocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    const newIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;
    if (newIndex < 0 || newIndex >= currentBlocks.length) return;

    const newBlocks = [...currentBlocks];
    [newBlocks[blockIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[blockIndex]];

    // Update order values
    const reorderedBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));

    await upsertPlan({
      childId,
      dayOfWeek: selectedDay,
      blocks: reorderedBlocks,
    });
  }, [childId, currentBlocks, selectedDay, upsertPlan]);

  if (!child) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">
            Weekly Planner for {child.name}
          </h1>
          <p className="text-gray-600">
            Plan {child.name}&apos;s weekly learning schedule
          </p>
        </div>
        <div className="flex gap-2">
          {currentBlocks.length > 0 && (
            <button
              onClick={() => setShowCopyModal(true)}
              className="btn-secondary text-sm">
              Copy to Other Days
            </button>
          )}
        </div>
      </div>

      {/* Day tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {DAYS.map((day, index) => {
            const plan = weeklyPlans?.find((p) => p.dayOfWeek === index);
            const blockCount = plan?.blocks?.length ?? 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(index)}
                className={`flex-1 min-w-[80px] px-3 py-4 text-center transition-colors ${
                  selectedDay === index
                    ? "bg-primary-50 border-b-2 border-primary-500 text-primary-700"
                    : "text-gray-500 hover:bg-gray-50"
                }`}>
                <span className="block font-medium text-sm
                                 sm:text-base">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{SHORT_DAYS[index]}</span>
                </span>
                {blockCount > 0 && (
                  <span className="text-xs text-gray-400 mt-1 block">
                    {blockCount} {blockCount === 1 ? "block" : "blocks"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{DAYS[selectedDay]}</h2>
                {isSelectedDayToday && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    Today
                  </span>
                )}
              </div>
              {totalMinutes > 0 && (
                <p className="text-sm text-gray-500">
                  Total: {hours > 0 ? `${hours}h ` : ""}{minutes > 0 ? `${minutes}m` : ""}
                  {isSelectedDayToday && todayProgress && (
                    <span className="ml-2 text-green-600">
                      • {todayProgress.blocks?.filter((b) => b.status === "completed" || b.status === "skipped").length ?? 0}/{currentBlocks.length} complete
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setEditingBlock(null);
                setShowBlockModal(true);
              }}
              className="btn-primary">
              + Add Block
            </button>
          </div>

          {/* Blocks list */}
          {currentBlocks.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-gray-500">No activities scheduled for {DAYS[selectedDay]}</p>
              <div className="mt-4 flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    setEditingBlock(null);
                    setShowBlockModal(true);
                  }}
                  className="text-primary-600 hover:text-primary-700 font-medium">
                  Add your first activity
                </button>
                {/* Quick copy from Monday if Monday has activities and today doesn't */}
                {selectedDay !== 1 && weeklyPlans?.find((p) => p.dayOfWeek === 1)?.blocks?.length ? (
                  <button
                    onClick={handleCopyFromMonday}
                    className="text-sm text-gray-500 hover:text-gray-700">
                    or copy from Monday ({weeklyPlans?.find((p) => p.dayOfWeek === 1)?.blocks?.length} blocks)
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentBlocks.map((block, index) => {
                const subject = SUBJECTS.find((s) => s.id === block.subject);
                const blockStatus = getBlockStatus(block.id);

                return (
                  <div
                    key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      blockStatus === "in_progress"
                        ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                        : blockStatus === "completed"
                        ? "bg-green-50 border-green-200"
                        : block.type === "break"
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200"
                    }`}>
                    {/* Move buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveBlock(block.id, "up")}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveBlock(block.id, "down")}
                        disabled={index === currentBlocks.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
                        ▼
                      </button>
                    </div>

                    {/* Status indicator (only shown for today) */}
                    {blockStatus !== null && (
                      <div className="flex-shrink-0">
                        {blockStatus === "completed" && <span className="text-xl" title="Complete">✅</span>}
                        {blockStatus === "skipped" && <span className="text-xl" title="Skipped">⏭️</span>}
                        {blockStatus === "in_progress" && <span className="text-xl animate-pulse" title="In Progress">▶️</span>}
                        {blockStatus === "pending" && <span className="text-xl text-gray-300" title="Not Started">⬜</span>}
                      </div>
                    )}

                    {/* Block info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {block.type === "break" ? "☕" : subject?.emoji || "📖"}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {block.type === "break"
                              ? "Break"
                              : subject?.name || block.subject}
                          </p>
                          {block.type === "lesson" && block.mode === "recommendations" && (
                            <p className="text-xs text-gray-500">IXL Recommendations</p>
                          )}
                          {block.instructions && (
                            <p className="text-xs text-gray-400 truncate max-w-xs">
                              {block.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge (only shown for today) */}
                    {blockStatus !== null && (
                      <div className="flex-shrink-0">
                        {blockStatus === "completed" && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                            Complete
                          </span>
                        )}
                        {blockStatus === "skipped" && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                            Skipped
                          </span>
                        )}
                        {blockStatus === "in_progress" && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium animate-pulse">
                            In Progress
                          </span>
                        )}
                        {blockStatus === "pending" && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">
                            Not Started
                          </span>
                        )}
                      </div>
                    )}

                    {/* Duration */}
                    <div className="text-right">
                      <p className="font-medium text-gray-700">{block.durationMinutes} min</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingBlock(block);
                          setShowBlockModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-primary-600">
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this block?")) {
                            handleRemoveBlock(block.id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600">
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Block modal */}
      {showBlockModal && (
        <BlockModal
          block={editingBlock}
          onSave={editingBlock ? handleEditBlock : handleAddBlock}
          onClose={() => {
            setShowBlockModal(false);
            setEditingBlock(null);
          }}
        />
      )}

      {/* Copy day modal */}
      {showCopyModal && (
        <CopyDayModal
          fromDay={selectedDay}
          onCopy={handleCopyDay}
          onClose={() => setShowCopyModal(false)}
        />
      )}
    </div>
  );
}

// Block add/edit modal
function BlockModal({
  block,
  onSave,
  onClose,
}: {
  block: Block | null;
  onSave: (data: BlockFormData) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<"lesson" | "break">(block?.type ?? "lesson");
  const [subject, setSubject] = useState(block?.subject ?? "math");
  const [duration, setDuration] = useState(block?.durationMinutes ?? 20);
  const [instructions, setInstructions] = useState(block?.instructions ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: BlockFormData = {
      type,
      durationMinutes: duration,
      instructions: instructions || undefined,
    };

    if (type === "lesson") {
      data.subject = subject;
      data.mode = "recommendations";
      data.resource = {
        platform: "ixl",
        name: `IXL ${SUBJECTS.find((s) => s.id === subject)?.name} Recommendations`,
        url: IXL_URLS[subject] || IXL_URLS.math,
      };
    }

    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          {block ? "Edit Block" : "Add Block"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="lesson"
                  checked={type === "lesson"}
                  onChange={() => setType("lesson")}
                  className="text-primary-600"
                />
                <span>📖 Lesson</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="break"
                  checked={type === "break"}
                  onChange={() => setType("break")}
                  className="text-primary-600"
                />
                <span>☕ Break</span>
              </label>
            </div>
          </div>

          {/* Subject (only for lessons) */}
          {type === "lesson" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubject(s.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      subject === s.id
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-primary-300"
                    }`}>
                    <span className="text-xl mr-2">{s.emoji}</span>
                    <span className="text-sm font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Uses IXL&apos;s personalized recommendations for {SUBJECTS.find((s) => s.id === subject)?.name}
              </p>
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration: {duration} minutes
            </label>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>5 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Quick duration buttons */}
          <div className="flex gap-2">
            {[10, 15, 20, 30, 45].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDuration(mins)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  duration === mins
                    ? "bg-primary-100 border-primary-300 text-primary-700"
                    : "border-gray-200 hover:border-primary-300"
                }`}>
                {mins}m
              </button>
            ))}
          </div>

          {/* Instructions (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={type === "break" ? "e.g., Go outside and play" : "e.g., Focus on multiplication"}
              rows={2}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500
                         sm:text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="submit" className="flex-1 btn-primary">
              {block ? "Save Changes" : "Add Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Copy day modal
function CopyDayModal({
  fromDay,
  onCopy,
  onClose,
}: {
  fromDay: number;
  onCopy: (toDay: number) => void;
  onClose: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleCopy = () => {
    selectedDays.forEach((day) => onCopy(day));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          Copy {DAYS[fromDay]}&apos;s Schedule
        </h2>
        <p className="text-gray-600 mb-4">
          Select which days to copy this schedule to:
        </p>

        <div className="space-y-2 mb-6">
          {DAYS.map((day, index) => {
            if (index === fromDay) return null;

            return (
              <label
                key={day}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDays.includes(index)
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-primary-300"
                }`}>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(index)}
                  onChange={() => toggleDay(index)}
                  className="rounded text-primary-600"
                />
                <span className="font-medium">{day}</span>
              </label>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={selectedDays.length === 0}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            Copy to {selectedDays.length} {selectedDays.length === 1 ? "Day" : "Days"}
          </button>
        </div>
      </div>
    </div>
  );
}
