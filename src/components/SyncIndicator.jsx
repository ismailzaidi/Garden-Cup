import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, HardDrive } from "lucide-react";
import { getStatus, onStatusChange } from "../lib/syncEngine.js";

const COPY = {
  local: { label: "Local only", icon: HardDrive, color: "#5C6B57", bg: "rgba(0,0,0,0.25)" },
  synced: { label: "Synced", icon: Cloud, color: "#F7F5EE", bg: "rgba(0,0,0,0.25)" },
  pending: { label: "Syncing…", icon: RefreshCw, color: "#F7F5EE", bg: "rgba(0,0,0,0.25)" },
  offline: { label: "Offline — will sync", icon: CloudOff, color: "#F7C9C2", bg: "rgba(0,0,0,0.3)" },
  error: { label: "Sync error", icon: AlertTriangle, color: "#F7C9C2", bg: "rgba(0,0,0,0.3)" },
};

export default function SyncIndicator() {
  const [status, setStatus] = useState(getStatus());

  useEffect(() => onStatusChange(setStatus), []);

  const meta = COPY[status] || COPY.local;
  const Icon = meta.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ backgroundColor: meta.bg }}
      title={meta.label}
    >
      <Icon size={11} color={meta.color} className={status === "pending" ? "animate-spin" : ""} />
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
    </div>
  );
}
