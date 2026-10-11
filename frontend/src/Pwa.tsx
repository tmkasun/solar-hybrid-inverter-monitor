import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { startUpdateChecks } from "./pwaLifecycle";
import type { I18n } from "./i18n";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const activationTimeout = 15000;
const standaloneQuery = "(display-mode: standalone)";
function isInstalled() {
  return Boolean(window.matchMedia?.(standaloneQuery).matches || (navigator as Navigator & { standalone?: boolean }).standalone);
}
function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function usePwa(busy: boolean) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installed, setInstalled] = useState(isInstalled);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const updatingRef = useRef(false);
  const updateAttempt = useRef(0);
  const mounted = useRef(true);
  const cleanupChecks = useRef<(() => void) | undefined>();
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration || !mounted.current) return;
      cleanupChecks.current?.();
      cleanupChecks.current = startUpdateChecks(registration, () => setNeedRefresh(true));
    },
    onRegisterError(error) { console.warn("PWA registration failed", error); },
  });

  useEffect(() => {
    mounted.current = true;
    const connectivityChanged = () => setOnline(navigator.onLine);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallError(false);
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(false);
      setInstallError(false);
    };
    const modeChanged = () => {
      const standalone = isInstalled();
      setInstalled(standalone);
      if (standalone) setInstallHelp(false);
    };
    const media = window.matchMedia?.(standaloneQuery);
    window.addEventListener("online", connectivityChanged);
    window.addEventListener("offline", connectivityChanged);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", appInstalled);
    media?.addEventListener("change", modeChanged);
    return () => {
      mounted.current = false;
      cleanupChecks.current?.();
      clearTimeout(timeout.current);
      window.removeEventListener("online", connectivityChanged);
      window.removeEventListener("offline", connectivityChanged);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", appInstalled);
      media?.removeEventListener("change", modeChanged);
    };
  }, []);

  const install = async () => {
    if (installed || installing) return;
    if (!installPrompt) { setInstallHelp(true); return; }
    setInstalling(true);
    setInstallError(false);
    try {
      // A browser install event can only be used once, including after dismissal.
      await installPrompt.prompt();
      await installPrompt.userChoice;
      if (mounted.current) setInstallPrompt(null);
    } catch {
      if (mounted.current) { setInstallPrompt(null); setInstallError(true); }
    } finally {
      if (mounted.current) setInstalling(false);
    }
  };

  const update = async () => {
    if (!needRefresh || busyRef.current || updatingRef.current) return;
    updatingRef.current = true;
    const attempt = ++updateAttempt.current;
    setUpdating(true);
    setDeferred(false);
    setUpdateError(false);
    const failed = () => {
      if (!mounted.current || attempt !== updateAttempt.current) return;
      clearTimeout(timeout.current);
      updatingRef.current = false;
      setUpdating(false);
      setUpdateError(true);
    };
    // Workbox's promise resolves after sending SKIP_WAITING, before activation.
    // Keep progress visible until reload, and recover if the worker never activates.
    timeout.current = setTimeout(failed, activationTimeout);
    try { await updateServiceWorker(true); } catch { failed(); }
  };

  return {
    online, installed, installing, installHelp, installError,
    canInstall: !installed && window.isSecureContext && (Boolean(installPrompt) || isAppleMobile()),
    needRefresh, deferred, updating, updateError, busy,
    install, update,
    deferUpdate: () => { if (!updatingRef.current) setDeferred(true); },
    showUpdate: () => setDeferred(false),
    closeInstallHelp: () => setInstallHelp(false),
    closeInstallError: () => setInstallError(false),
  };
}

export type PwaState = ReturnType<typeof usePwa>;

export function PwaActions({ pwa, i18n }: { pwa: PwaState; i18n: I18n }) {
  return <>
    {pwa.canInstall && <button type="button" className="quiet pwa-action" disabled={pwa.installing} onClick={() => void pwa.install()}>{i18n.t("pwa.install")}</button>}
    {pwa.needRefresh && pwa.deferred && <button type="button" className="quiet pwa-action" onClick={pwa.showUpdate}>{i18n.t("pwa.updateApp")}</button>}
  </>;
}

export function PwaNotices({ pwa, i18n }: { pwa: PwaState; i18n: I18n }) {
  return <div className="pwa-notices">
    {!pwa.online && <aside className="pwa-banner pwa-offline" role="status"><div><strong>{i18n.t("pwa.offline")}</strong><p>{i18n.t("pwa.offlineDetail")}</p></div></aside>}
    {pwa.installHelp && <aside className="pwa-banner" role="note" aria-label={i18n.t("pwa.install")}><div><strong>{i18n.t("pwa.install")}</strong><p>{i18n.t("pwa.appleInstallHelp")}</p></div><button type="button" className="quiet" onClick={pwa.closeInstallHelp}>{i18n.t("pwa.close")}</button></aside>}
    {pwa.installError && <aside className="pwa-banner" role="alert"><p>{i18n.t("pwa.installError")}</p><button type="button" className="quiet" onClick={pwa.closeInstallError}>{i18n.t("pwa.close")}</button></aside>}
    {pwa.needRefresh && !pwa.deferred && <aside className="pwa-banner pwa-update" role="status" aria-labelledby="pwa-update-title" aria-busy={pwa.updating}>
      <div><strong id="pwa-update-title">{i18n.t("pwa.updateAvailable")}</strong><p>{i18n.t(pwa.updating ? "pwa.updating" : "pwa.updateDetail")}</p>
        {pwa.busy && <p>{i18n.t("pwa.finishChanges")}</p>}
        {pwa.updateError && <p className="error" role="alert">{i18n.t("pwa.updateError")}</p>}
      </div>
      <div className="pwa-banner-actions"><button type="button" disabled={pwa.updating || pwa.busy} onClick={() => void pwa.update()}>{pwa.updating && <i className="spinner" aria-hidden="true" />}{i18n.t(pwa.updating ? "pwa.updating" : "pwa.updateNow")}</button><button type="button" className="quiet" disabled={pwa.updating} onClick={pwa.deferUpdate}>{i18n.t("pwa.later")}</button></div>
    </aside>}
  </div>;
}
