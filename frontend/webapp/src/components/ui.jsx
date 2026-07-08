export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`bg-s1 border border-b1 rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 text-sm font-semibold text-t1">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const STAT_COLOR = {
  b: "text-acc",
  g: "text-grn",
  r: "text-red",
  y: "text-yel",
  p: "text-pur",
};
const STAT_BAR = {
  b: "bg-acc",
  g: "bg-grn",
  r: "bg-red",
  y: "bg-yel",
  p: "bg-pur",
};

export function StatCard({ label, value, unit, tone = "b", icon }) {
  return (
    <div className="relative bg-s1 border border-b1 rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 overflow-hidden">
      <div className={`absolute top-0 left-0 w-10 h-0.5 rounded-full ${STAT_BAR[tone]}`} />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-t3">{label}</div>
      <div className={`text-[32px] font-extrabold leading-none my-1.5 tracking-tight ${STAT_COLOR[tone]}`}>{value}</div>
      {unit && <div className="text-xs text-t2">{unit}</div>}
      {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl opacity-[0.08]">{icon}</div>}
    </div>
  );
}

const BADGE_TONE = {
  grn: "bg-grn/10 text-grn border-grn/20",
  red: "bg-red/10 text-red border-red/20",
  yel: "bg-yel/10 text-yel border-yel/20",
  org: "bg-org/10 text-org border-org/20",
  blu: "bg-blu/10 text-blu border-blu/20",
  pur: "bg-pur/10 text-pur border-pur/20",
};

export function Badge({ tone = "blu", children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function glucoseBadge(value) {
  if (!value) return <Badge tone="blu">—</Badge>;
  if (value < 70) return <Badge tone="yel">{value} Low</Badge>;
  if (value <= 140) return <Badge tone="grn">{value} OK</Badge>;
  if (value <= 200) return <Badge tone="org">{value} High</Badge>;
  return <Badge tone="red">{value} Very High</Badge>;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans";
  const sizes = { md: "px-4 py-2.5 text-sm", sm: "px-3 py-1.5 text-[13px]" };
  const variants = {
    primary: "bg-acc text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-[#2367ba]",
    secondary: "bg-s1 text-t1 border border-b2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-s2",
    ghost: "bg-transparent text-t2 hover:text-t1 hover:bg-s2",
    danger: "bg-red/10 text-red border border-red/20 hover:bg-red/15",
    success: "bg-grn/10 text-grn border border-grn/20 hover:bg-grn/15",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Input({ label, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <input
        className="w-full px-3.5 py-2.5 bg-s1 border border-b2 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-3 focus:ring-acc/12 placeholder:text-t3"
        {...props}
      />
    </div>
  );
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <select
        className="w-full px-3.5 py-2.5 bg-s1 border border-b2 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-3 focus:ring-acc/12 cursor-pointer"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <textarea
        className="w-full px-3.5 py-2.5 bg-s1 border border-b2 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-3 focus:ring-acc/12 resize-y min-h-[80px] placeholder:text-t3"
        {...props}
      />
    </div>
  );
}

export function Alert({ tone = "error", children }) {
  const tones = {
    error: "bg-red/8 text-red border-red/20",
    success: "bg-grn/8 text-grn border-grn/20",
    info: "bg-blu/8 text-blu border-blu/20",
    warn: "bg-yel/8 text-yel border-yel/20",
  };
  if (!children) return null;
  return <div className={`px-3.5 py-2.5 rounded-lg text-sm mb-4 border ${tones[tone]}`}>{children}</div>;
}

export function Loader({ className = "" }) {
  return (
    <div
      className={`spinner inline-block w-4 h-4 rounded-full border-2 border-b1 border-t-acc ${className}`}
    />
  );
}

export function Empty({ icon = "•", children }) {
  return (
    <div className="text-center py-10 px-4 text-t3 text-sm">
      <div className="text-3xl mb-2 opacity-40">{icon}</div>
      {children}
    </div>
  );
}

export function fmtDateTime(d) {
  return d
    ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
