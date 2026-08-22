import { C } from "../lib/theme.js";

export default function EmptyCard({ children }) {
  return (
    <div className="rounded-2xl p-6 text-center text-sm" style={{ backgroundColor: "#fff", border: `2px dashed ${C.line}`, color: C.mute }}>
      {children}
    </div>
  );
}
