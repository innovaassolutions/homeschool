import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAgeAdaptive } from "../../hooks/useAgeAdaptive";

type AgeGroup = "ages6to9" | "ages10to13" | "ages14to16";

export type CameraPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

interface CameraPermissionsProps {
  ageGroup: AgeGroup;
  onRequest?: () => Promise<void> | void;
  onGranted?: () => void;
  onDenied?: (reason?: string) => void;
  className?: string;
}

export const CameraPermissions: React.FC<CameraPermissionsProps> = ({
  ageGroup,
  onRequest,
  onGranted,
  onDenied,
  className = "",
}) => {
  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  const [state, setState] = useState<CameraPermissionState>("unknown");
  const [message, setMessage] = useState<string | null>(null);

  const supported = useMemo(() => !!navigator.mediaDevices?.getUserMedia, []);

  // Probe existing permission if Permissions API exists (best effort)
  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      setMessage("Camera not supported in this browser");
      return;
    }

    let cancelled = false;

    const checkPermission = async () => {
      try {
        // Not all browsers expose 'camera' permission name; fallback to prompt state
        const permissions = (navigator as any).permissions;
        if (!permissions?.query) {
          if (!cancelled) setState("prompt");
          return;
        }
        const status = await permissions.query({
          name: "camera" as PermissionName,
        });
        if (cancelled) return;
        if (status.state === "granted") setState("granted");
        else if (status.state === "denied") setState("denied");
        else setState("prompt");
      } catch {
        if (!cancelled) setState("prompt");
      }
    };

    checkPermission();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const requestAccess = useCallback(async () => {
    try {
      setMessage(null);
      setState("prompt");

      // Allow parent to run custom logic (e.g., open camera preview)
      await onRequest?.();

      // If onRequest succeeds, we assume permission was granted
      setState("granted");
      onGranted?.();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Permission denied";
      setState("denied");
      setMessage(reason);
      onDenied?.(reason);
    }
  }, [onRequest, onGranted, onDenied]);

  const heading = useMemo(
    () =>
      state === "granted"
        ? text.simple
          ? "All set!"
          : "Camera Ready"
        : state === "denied"
          ? text.simple
            ? "Permission needed"
            : "Camera Permission Needed"
          : state === "unsupported"
            ? text.simple
              ? "Not supported"
              : "Camera Not Supported"
            : text.simple
              ? "Camera Permission"
              : "Allow Camera Access",
    [state, text]
  );

  return (
    <div className={`camera-permissions ${className}`}>
      <div
        className={`
        bg-white rounded-lg border border-gray-200 p-6 text-center
        ${styles.spacing.comfortable}
      `}
      >
        <div className="text-5xl mb-3">
          {state === "granted"
            ? "✅"
            : state === "denied"
              ? "🔐"
              : state === "unsupported"
                ? "🚫"
                : "🔓"}
        </div>
        <h3 className={`${styles.text.subheading} mb-2`}>{heading}</h3>
        <p className={`${styles.text.body} text-gray-600 mb-4`}>
          {state === "granted" &&
            (text.simple
              ? "You can take photos now."
              : "You can now use the camera to capture photos.")}
          {state === "denied" &&
            (text.simple
              ? "Please allow camera access in your browser settings."
              : "Please allow camera access in your browser settings and try again.")}
          {state === "unsupported" &&
            (text.simple
              ? "Try a different device or upload a photo instead."
              : "Your browser does not support camera access. You can upload a photo from your device instead.")}
          {state !== "granted" &&
            state !== "denied" &&
            state !== "unsupported" &&
            (text.simple
              ? "We need camera access to take a picture of your work."
              : "To capture your work, this app needs permission to use your camera.")}
        </p>

        {message && (
          <div className="mb-4">
            <span className={`${styles.text.small} text-red-600`}>
              {message}
            </span>
          </div>
        )}

        {(state === "prompt" || state === "unknown") && (
          <button
            onClick={requestAccess}
            className={`${styles.button.primary} ${styles.text.body} py-2 px-4 rounded-lg`}
          >
            {text.simple ? "Allow Camera" : "Allow Camera Access"}
          </button>
        )}

        {state === "denied" && (
          <div className={`${styles.text.small} text-gray-600 mt-3`}>
            {text.simple
              ? "Open browser settings to enable the camera."
              : "Open your browser site settings to enable camera permissions and then try again."}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraPermissions;
