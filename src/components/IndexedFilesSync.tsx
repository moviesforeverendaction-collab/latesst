import { useEffect, useEffectEvent, useRef } from "react";
import toast from "react-hot-toast";
import { fetchBackendJson, getBackendUrl, type BackendFilesResponse } from "../lib/backend";
import { useStore, type IndexedFile } from "../store/useStore";

const INDEXED_FILES_LIMIT = 60;
const INDEXED_FILES_POLL_MS = 15000;

export default function IndexedFilesSync() {
  const { telegramConfig, setIndexedFiles } = useStore();
  const backendUrl = getBackendUrl(telegramConfig.backendUrl);
  const firstLoadDoneRef = useRef(false);
  const latestFileIdRef = useRef<string>("");

  const syncIndexedFiles = useEffectEvent(async () => {
    if (!backendUrl) return;

    try {
      const data = await fetchBackendJson<BackendFilesResponse<IndexedFile>>(
        `/api/files?limit=${INDEXED_FILES_LIMIT}&sort=indexed_at&dir=desc`,
        undefined,
        backendUrl
      );

      if (!data.ok) return;

      const latestFileId = data.files[0]?.file_unique_id || "";
      const shouldAnnounce =
        firstLoadDoneRef.current &&
        latestFileId &&
        latestFileIdRef.current &&
        latestFileId !== latestFileIdRef.current &&
        document.visibilityState === "visible";

      setIndexedFiles(data.files);
      latestFileIdRef.current = latestFileId;

      if (shouldAnnounce) {
        toast.success("New indexed files are live on the website.");
      }

      firstLoadDoneRef.current = true;
    } catch {
      // Silent background sync: keep last successful data on screen.
    }
  });

  useEffect(() => {
    if (!backendUrl) return;

    syncIndexedFiles();

    const intervalId = window.setInterval(() => {
      syncIndexedFiles();
    }, INDEXED_FILES_POLL_MS);

    const handleFocus = () => syncIndexedFiles();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncIndexedFiles();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [backendUrl, syncIndexedFiles]);

  return null;
}
