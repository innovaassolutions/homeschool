"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

type LoginStep = "family_code" | "select_child" | "enter_pin";

export default function ChildLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("family_code");
  const [familyCode, setFamilyCode] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<Id<"childProfiles"> | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  // Query family and children based on family code
  const family = useQuery(
    api.families.getByFamilyCode,
    familyCode.length >= 4 ? { familyCode } : "skip"
  );
  const children = useQuery(
    api.families.getChildrenByFamilyCode,
    familyCode.length >= 4 ? { familyCode } : "skip"
  );

  // Verify PIN
  const pinVerification = useQuery(
    api.childProfiles.verifyPin,
    selectedChildId && pin.length === 4 ? { childId: selectedChildId, pin } : "skip"
  );

  const markActive = useMutation(api.childProfiles.markActive);

  // Handle PIN verification result
  useEffect(() => {
    if (pinVerification?.success && pinVerification.child) {
      // Store child session in localStorage
      localStorage.setItem("childSession", JSON.stringify({
        childId: pinVerification.child._id,
        name: pinVerification.child.name,
        ageGroup: pinVerification.child.ageGroup,
        avatarEmoji: pinVerification.child.avatarEmoji,
        familyId: pinVerification.child.familyId,
        loginTime: Date.now(),
      }));

      // Mark child as active
      markActive({ childId: pinVerification.child._id });

      // Redirect to child's daily view
      router.push("/today");
    } else if (pinVerification && !pinVerification.success) {
      setError(pinVerification.error || "Incorrect PIN");
      setPin("");
    }
  }, [pinVerification, markActive, router]);

  const handleFamilyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (family) {
      setStep("select_child");
    } else {
      setError("Family not found. Check your code and try again.");
    }
  };

  const handleSelectChild = (childId: Id<"childProfiles">) => {
    setSelectedChildId(childId);
    setPin("");
    setError("");
    setStep("enter_pin");
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
      setError("");
    }
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleBack = () => {
    if (step === "enter_pin") {
      setStep("select_child");
      setPin("");
      setSelectedChildId(null);
    } else if (step === "select_child") {
      setStep("family_code");
      setFamilyCode("");
    }
    setError("");
  };

  const selectedChild = children?.find((c) => c._id === selectedChildId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Step 1: Enter Family Code */}
        {step === "family_code" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🏠</div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
              <p className="text-gray-600 mt-2">Enter your family code to get started</p>
            </div>

            <form onSubmit={handleFamilyCodeSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl font-mono tracking-widest py-4 px-4
                             border-2 border-gray-300 rounded-xl
                             focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="XXXX-0000"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-500 text-center text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={familyCode.length < 4}
                className="w-full py-4 bg-blue-500 text-white text-xl font-semibold rounded-xl
                           hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                           transition-colors">
                Next
              </button>
            </form>

            <div className="text-center">
              <a href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                Parent login →
              </a>
            </div>
          </div>
        )}

        {/* Step 2: Select Child */}
        {step === "select_child" && children && (
          <div className="space-y-6">
            <button
              onClick={handleBack}
              className="text-gray-500 hover:text-gray-700">
              ← Back
            </button>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Who's learning today?</h1>
              <p className="text-gray-600 mt-2">{family?.name} Family</p>
            </div>

            <div className="grid gap-4">
              {children.map((child) => (
                <button
                  key={child._id}
                  onClick={() => handleSelectChild(child._id)}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200
                             hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <span className="text-4xl">{child.avatarEmoji}</span>
                  <div className="text-left">
                    <div className="font-semibold text-lg text-gray-900">{child.name}</div>
                    <div className="text-sm text-gray-500">
                      {child.ageGroup === "ages6to9" && "Ages 6-9"}
                      {child.ageGroup === "ages10to13" && "Ages 10-13"}
                      {child.ageGroup === "ages14to16" && "Ages 14-16"}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {children.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No children found. Ask your parent to add you!
              </div>
            )}
          </div>
        )}

        {/* Step 3: Enter PIN */}
        {step === "enter_pin" && selectedChild && (
          <div className="space-y-6">
            <button
              onClick={handleBack}
              className="text-gray-500 hover:text-gray-700">
              ← Back
            </button>

            <div className="text-center">
              <span className="text-6xl">{selectedChild.avatarEmoji}</span>
              <h1 className="text-2xl font-bold text-gray-900 mt-4">Hi, {selectedChild.name}!</h1>
              <p className="text-gray-600 mt-2">Enter your 4-digit PIN</p>
            </div>

            {/* PIN Display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-3xl
                    ${pin.length > i ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}>
                  {pin.length > i ? "●" : ""}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-red-500 text-center">{error}</p>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "back"].map((digit, i) => {
                if (digit === null) {
                  return <div key={i} />;
                }
                if (digit === "back") {
                  return (
                    <button
                      key={i}
                      onClick={handlePinBackspace}
                      className="h-16 rounded-xl bg-gray-100 text-2xl
                                 hover:bg-gray-200 active:bg-gray-300 transition-colors">
                      ⌫
                    </button>
                  );
                }
                return (
                  <button
                    key={i}
                    onClick={() => handlePinDigit(String(digit))}
                    className="h-16 rounded-xl bg-gray-100 text-2xl font-semibold
                               hover:bg-gray-200 active:bg-gray-300 transition-colors">
                    {digit}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
