import React, { useEffect, useState, useCallback } from "react";
import { useAgeAdaptive } from "../../hooks/useAgeAdaptive";
import { useSessionStore } from "../../stores/sessionStore";
import type {
  AgeGroup,
  SessionType,
  CreateSessionRequest,
} from "../../stores/sessionStore";
import { SessionTimer } from "./SessionTimer";
import { SessionControls } from "./SessionControls";
import { BreakReminder } from "./BreakReminder";
import { SessionComplete } from "./SessionComplete";
import { CameraCapture, PhotoGallery, CameraPermissions } from "../camera";

// Photo metadata interface
interface PhotoMetadata {
  id: string;
  filename: string;
  format: string;
  size: number;
  qualityScore: number;
  analysisReady: boolean;
  timestamp: Date;
  sessionId?: string;
}

interface SessionManagerProps {
  childId: string;
  ageGroup: AgeGroup;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (sessionId: string, completed: boolean) => void;
  enableCamera?: boolean;
  className?: string;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  childId,
  ageGroup,
  onSessionStart,
  onSessionEnd,
  enableCamera = true,
  className = "",
}) => {
  const {
    currentSession,
    isSessionActive,
    isLoading,
    error,
    showBreakReminder,
    showSessionComplete,
    createSession,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    abandonSession,
    clearError,
    dismissBreakReminder,
    dismissSessionComplete,
  } = useSessionStore();

  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();

  // Local state for session creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionType, setNewSessionType] = useState<SessionType>("lesson");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDescription, setNewSessionDescription] = useState("");

  // Camera-related state
  const [showCamera, setShowCamera] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState<PhotoMetadata[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Age-adaptive styling
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Handle session completion
  useEffect(() => {
    if (
      currentSession &&
      currentSession.state === "completed" &&
      onSessionEnd
    ) {
      onSessionEnd(currentSession.id, true);
    }
    if (
      currentSession &&
      currentSession.state === "abandoned" &&
      onSessionEnd
    ) {
      onSessionEnd(currentSession.id, false);
    }
  }, [currentSession?.state, onSessionEnd]);

  // Handle session start callback
  useEffect(() => {
    if (currentSession && isSessionActive && onSessionStart) {
      onSessionStart(currentSession.id);
    }
  }, [currentSession?.id, isSessionActive, onSessionStart]);

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim()) {
      return;
    }

    const request: CreateSessionRequest = {
      type: newSessionType,
      childId,
      ageGroup,
      title: newSessionTitle.trim(),
      description: newSessionDescription.trim() || undefined,
      learningObjectives: [],
    };

    await createSession(request);
    setShowCreateForm(false);
    setNewSessionTitle("");
    setNewSessionDescription("");
  };

  const handleStartSession = async () => {
    if (currentSession) {
      await startSession(currentSession.id);
    }
  };

  const handlePauseSession = async () => {
    if (currentSession) {
      await pauseSession(currentSession.id);
    }
  };

  const handleResumeSession = async () => {
    if (currentSession) {
      await resumeSession(currentSession.id);
    }
  };

  const handleCompleteSession = async () => {
    if (currentSession) {
      await completeSession(currentSession.id);
    }
  };

  const handleAbandonSession = async () => {
    if (currentSession) {
      await abandonSession(currentSession.id);
    }
  };

  // Camera-related handlers
  const handlePhotoCapture = useCallback(
    (photo: PhotoMetadata, imageBlob: Blob) => {
      setSessionPhotos((prev) => [...prev, photo]);
      setPhotoError(null);

      // Log photo capture for session
      console.log("Photo captured for session:", {
        sessionId: currentSession?.id,
        photoId: photo.id,
        analysisReady: photo.analysisReady,
      });
    },
    [currentSession?.id]
  );

  const handlePhotoError = useCallback((error: string) => {
    setPhotoError(error);
  }, []);

  const handleShowCamera = useCallback(() => {
    if (!currentSession || !isSessionActive) {
      // If no active session, create one first
      setNewSessionType("practice");
      setNewSessionTitle("Photo Session");
      setShowCreateForm(true);
      return;
    }

    setShowCamera(true);
    setPhotoError(null);
  }, [currentSession, isSessionActive]);

  const handleHideCamera = useCallback(() => {
    setShowCamera(false);
  }, []);

  // Load session photos when session changes
  useEffect(() => {
    if (currentSession?.id && enableCamera) {
      // Fetch existing photos for the session
      fetch(`/api/photos/session/${currentSession.id}`, {
        credentials: "include",
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Failed to fetch session photos");
        })
        .then((data) => {
          setSessionPhotos(data.photos || []);
        })
        .catch((error) => {
          console.error("Error loading session photos:", error);
        });
    } else {
      setSessionPhotos([]);
    }
  }, [currentSession?.id, enableCamera]);

  const getSessionTypeLabel = (type: SessionType) => {
    const labels = {
      assessment: text.simple ? "Test" : "Assessment",
      lesson: text.simple ? "Learn" : "Lesson",
      practice: text.simple ? "Practice" : "Practice",
      review: text.simple ? "Review" : "Review",
    };
    return labels[type];
  };

  return (
    <div className={`session-manager ${className}`}>
      {/* Error display */}
      {error && (
        <div
          className={`
          bg-red-50 border border-red-200 rounded-lg p-4 mb-4
          ${styles.text.error}
        `}
        >
          <div className="flex justify-between items-center">
            <p className="font-medium">Oops! Something went wrong</p>
            <button
              onClick={clearError}
              className={`
                ${styles.button.ghost} ${styles.text.small}
                hover:bg-red-100
              `}
            >
              ✕
            </button>
          </div>
          <p className={`${styles.text.small} mt-1 text-red-600`}>{error}</p>
        </div>
      )}

      {/* Main session interface */}
      {!currentSession ? (
        // No session - show creation form
        <div
          className={`
          bg-white rounded-lg border border-gray-200 p-6
          ${styles.spacing.comfortable}
        `}
        >
          <h2 className={`${styles.text.heading} mb-4`}>
            {text.simple ? "Start Learning!" : "Start a Learning Session"}
          </h2>

          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={isLoading}
              className={`
                ${styles.button.primary} w-full
                ${styles.text.action}
                ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {isLoading
                ? "Creating..."
                : text.simple
                  ? "Start!"
                  : "Create New Session"}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Session type selection */}
              <div>
                <label className={`${styles.text.label} block mb-2`}>
                  {text.simple ? "What do you want to do?" : "Session Type"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "lesson",
                      "practice",
                      "review",
                      "assessment",
                    ] as SessionType[]
                  ).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewSessionType(type)}
                      className={`
                        p-3 rounded-lg border transition-colors
                        ${
                          newSessionType === type
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        }
                        ${styles.text.body}
                      `}
                    >
                      {getSessionTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session title */}
              <div>
                <label className={`${styles.text.label} block mb-2`}>
                  {text.simple ? "What are you learning?" : "Session Title"}
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder={
                    text.simple
                      ? "Math, Science, Reading..."
                      : "Enter session title"
                  }
                  className={`
                    w-full p-3 border border-gray-300 rounded-lg
                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                    ${styles.text.body}
                  `}
                />
              </div>

              {/* Session description (optional for older kids) */}
              {!text.simple && (
                <div>
                  <label className={`${styles.text.label} block mb-2`}>
                    Description (Optional)
                  </label>
                  <textarea
                    value={newSessionDescription}
                    onChange={(e) => setNewSessionDescription(e.target.value)}
                    placeholder="What will you focus on in this session?"
                    rows={3}
                    className={`
                      w-full p-3 border border-gray-300 rounded-lg
                      focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                      ${styles.text.body}
                    `}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateSession}
                  disabled={!newSessionTitle.trim() || isLoading}
                  className={`
                    ${styles.button.primary} flex-1
                    ${!newSessionTitle.trim() || isLoading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {isLoading
                    ? "Creating..."
                    : text.simple
                      ? "Create!"
                      : "Create Session"}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className={`${styles.button.ghost} px-4`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Active session interface
        <div className="space-y-4">
          {/* Session header */}
          <div
            className={`
            bg-white rounded-lg border border-gray-200 p-4
            ${styles.spacing.comfortable}
          `}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className={`${styles.text.heading} mb-1`}>
                  {currentSession.title}
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className={`
                    inline-block px-2 py-1 rounded-full text-xs font-medium
                    ${
                      currentSession.state === "active"
                        ? "bg-green-100 text-green-800"
                        : currentSession.state === "paused"
                          ? "bg-yellow-100 text-yellow-800"
                          : currentSession.state === "break"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                    }
                  `}
                  >
                    {getSessionTypeLabel(currentSession.type)}
                  </span>
                  <span className={`${styles.text.small} text-gray-500`}>
                    {currentSession.state === "active"
                      ? text.simple
                        ? "Active"
                        : "In Progress"
                      : currentSession.state === "paused"
                        ? text.simple
                          ? "Paused"
                          : "Paused"
                        : currentSession.state === "break"
                          ? text.simple
                            ? "Break Time"
                            : "Break Time"
                          : currentSession.state}
                  </span>
                </div>
              </div>

              {/* Session timer */}
              <SessionTimer ageGroup={ageGroup} />
            </div>

            {currentSession.description && (
              <p className={`${styles.text.body} text-gray-600 mt-2`}>
                {currentSession.description}
              </p>
            )}
          </div>

          {/* Session controls */}
          <SessionControls
            ageGroup={ageGroup}
            session={currentSession}
            isSessionActive={isSessionActive}
            isLoading={isLoading}
            onStart={handleStartSession}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
            onComplete={handleCompleteSession}
            onAbandon={handleAbandonSession}
          />

          {/* Camera integration */}
          {enableCamera && currentSession && (
            <>
              {/* Camera toggle button */}
              {!showCamera && (
                <div
                  className={`
                  bg-white rounded-lg border border-gray-200 p-4
                  ${styles.spacing.comfortable}
                `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`${styles.text.subheading} mb-1`}>
                        {text.simple ? "📸 Show Your Work" : "📸 Photo Capture"}
                      </h3>
                      <p className={`${styles.text.body} text-gray-600`}>
                        {text.simple
                          ? "Take a picture so I can help you better!"
                          : "Capture photos of your work for AI analysis and feedback."}
                      </p>
                      {sessionPhotos.length > 0 && (
                        <p
                          className={`${styles.text.small} text-blue-600 mt-1`}
                        >
                          {sessionPhotos.length} photo
                          {sessionPhotos.length !== 1 ? "s" : ""} in this
                          session
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleShowCamera}
                      disabled={!isSessionActive}
                      className={`
                        ${styles.button.primary}
                        ${!isSessionActive ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                    >
                      {text.simple ? "📸 Camera" : "📸 Open Camera"}
                    </button>
                  </div>

                  {/* Photo error display */}
                  {photoError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className={`${styles.text.small} text-red-600`}>
                        {photoError}
                      </p>
                    </div>
                  )}

                  {/* Camera permissions helper UI */}
                  <div className="mt-4">
                    <CameraPermissions
                      ageGroup={ageGroup}
                      onRequest={async () => {
                        // Opening camera panel triggers getUserMedia inside CameraCapture
                        if (isSessionActive) {
                          setShowCamera(true);
                        } else {
                          setPhotoError(
                            "Start the session first to use the camera."
                          );
                          throw new Error("Session not active");
                        }
                      }}
                      onGranted={() => {
                        setPhotoError(null);
                      }}
                      onDenied={(reason) => {
                        setPhotoError(reason || "Camera permission denied.");
                      }}
                    />
                  </div>

                  {/* Session photos gallery */}
                  {sessionPhotos.length > 0 && (
                    <div className="mt-4">
                      <PhotoGallery
                        ageGroup={ageGroup}
                        photos={sessionPhotos}
                        maxPhotosToShow={3}
                        showAnalysisInfo={!text.simple}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Camera capture interface */}
              {showCamera && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className={`${styles.text.subheading}`}>
                      {text.simple ? "📸 Take Photo" : "📸 Camera"}
                    </h3>
                    <button
                      onClick={handleHideCamera}
                      className={`${styles.button.ghost} px-3 py-1`}
                    >
                      {text.simple ? "✕ Close" : "✕ Close Camera"}
                    </button>
                  </div>

                  <CameraCapture
                    ageGroup={ageGroup}
                    sessionId={currentSession.id}
                    onPhotoCapture={handlePhotoCapture}
                    onError={handlePhotoError}
                    maxPhotos={5}
                    autoProcess={true}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Break reminder modal */}
      {showBreakReminder && (
        <BreakReminder
          ageGroup={ageGroup}
          onDismiss={dismissBreakReminder}
          onResumeSession={handleResumeSession}
        />
      )}

      {/* Session complete modal */}
      {showSessionComplete && currentSession && (
        <SessionComplete
          ageGroup={ageGroup}
          session={currentSession}
          onDismiss={dismissSessionComplete}
          onNewSession={() => {
            dismissSessionComplete();
            setShowCreateForm(true);
          }}
        />
      )}
    </div>
  );
};
