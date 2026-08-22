import { C } from "../lib/theme.js";

export default function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.sub }}>{children}</p>
      {right}
    </div>
  );
}
