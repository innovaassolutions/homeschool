"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function DashboardPage() {
  const family = useQuery(api.families.get);
  const children = useQuery(api.childProfiles.list);
  const createChild = useMutation(api.childProfiles.create);

  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildAge, setNewChildAge] = useState<"ages6to9" | "ages10to13" | "ages14to16">("ages6to9");
  const [selectedChild, setSelectedChild] = useState<Id<"childProfiles"> | null>(null);

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    await createChild({ name: newChildName, ageGroup: newChildAge });
    setNewChildName("");
    setShowAddChild(false);
  };

  if (!family) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Complete Your Profile</h2>
        <p className="mt-2 text-gray-600">Please complete your family registration first.</p>
        <Link href="/register" className="mt-4 btn-primary inline-block">
          Complete Registration
        </Link>
      </div>
    );
  }

  const currentChild = selectedChild
    ? children?.find((c) => c._id === selectedChild)
    : children?.[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4
                      md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {family.name}!</h1>
          <p className="text-gray-600">Select a child to start learning</p>
        </div>
        <button
          onClick={() => setShowAddChild(true)}
          className="btn-primary">
          Add Child
        </button>
      </div>

      {/* Child selector */}
      {children && children.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Children</h2>
          <div className="grid gap-4
                          sm:grid-cols-2
                          lg:grid-cols-3">
            {children.map((child) => (
              <button
                key={child._id}
                onClick={() => setSelectedChild(child._id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentChild?._id === child._id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-primary-300"
                }`}>
                <div className="font-medium text-gray-900">{child.name}</div>
                <div className="text-sm text-gray-500">
                  {child.ageGroup === "ages6to9" && "Ages 6-9"}
                  {child.ageGroup === "ages10to13" && "Ages 10-13"}
                  {child.ageGroup === "ages14to16" && "Ages 14-16"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start session */}
      {currentChild && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Start a Learning Session</h2>
          <p className="text-gray-600 mb-6">
            Ready to learn with {currentChild.name}? Choose a subject to get started.
          </p>
          <div className="grid gap-4
                          sm:grid-cols-2
                          lg:grid-cols-4">
            {["Math", "English", "Science", "History"].map((subject) => (
              <Link
                key={subject}
                href={`/dashboard/session?childId=${currentChild._id}&subject=${subject.toLowerCase()}`}
                className="p-6 rounded-lg border border-gray-200 text-center transition-all
                           hover:border-primary-300 hover:shadow-md">
                <div className="text-3xl mb-2">
                  {subject === "Math" && "🔢"}
                  {subject === "English" && "📚"}
                  {subject === "Science" && "🔬"}
                  {subject === "History" && "🏛️"}
                </div>
                <div className="font-medium text-gray-900">{subject}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!children || children.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
          <h2 className="text-xl font-semibold text-gray-900">Add your first child</h2>
          <p className="mt-2 text-gray-600">
            Get started by adding a child profile to begin learning.
          </p>
          <button
            onClick={() => setShowAddChild(true)}
            className="mt-4 btn-primary">
            Add Child
          </button>
        </div>
      )}

      {/* Add child modal */}
      {showAddChild && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Add Child Profile</h2>
            <form onSubmit={handleAddChild} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500
                             sm:text-sm"
                  placeholder="Child's name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Age Group</label>
                <select
                  value={newChildAge}
                  onChange={(e) => setNewChildAge(e.target.value as typeof newChildAge)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500
                             sm:text-sm">
                  <option value="ages6to9">Ages 6-9</option>
                  <option value="ages10to13">Ages 10-13</option>
                  <option value="ages14to16">Ages 14-16</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Add Child
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
