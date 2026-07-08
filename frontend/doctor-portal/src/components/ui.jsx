export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`bg-s1 border border-b1 rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 text-sm font-bold">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const STAT_COLOR = {
  b: "text-blu",
  g: "text-grn",
  r: "text-red",
  y: "text-yel",
  p: "text-pur",
};
const STAT_BAR = {
  b: "from-blu",
  g: "from-grn",
  r: "from-red",
  y: "from-yel",
  p: "from-pur",
};

export function StatCard({ label, value, unit, tone = "b", icon }) {
  return (
    <div className="relative bg-s1 border border-b1 rounded-2xl p-5 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${STAT_BAR[tone]} to-transparent`} />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-t3">{label}</div>
      <div className={`text-[34px] font-extrabold leading-none my-1.5 tracking-tight ${STAT_COLOR[tone]}`}>{value}</div>
      {unit && <div className="text-xs text-t2">{unit}</div>}
      {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl opacity-10">{icon}</div>}
    </div>
  );
}

const BADGE_TONE = {
  grn: "bg-grn/10 text-grn border-grn/25",
  red: "bg-red/10 text-red border-red/25",
  yel: "bg-yel/10 text-yel border-yel/25",
  blu: "bg-blu/10 text-blu border-blu/25",
  pur: "bg-pur/10 text-pur border-pur/25",
};

export function Badge({ tone = "blu", children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function glucoseBadge(value) {
  if (!value) return <Badge tone="blu">—</Badge>;
  if (value < 70) return <Badge tone="yel">{value} Low</Badge>;
  if (value <= 140) return <Badge tone="grn">{value} OK</Badge>;
  if (value <= 200) return <Badge tone="yel">{value} High</Badge>;
  return <Badge tone="red">{value} Very High</Badge>;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans";
  const sizes = { md: "px-5 py-2.5 text-sm", sm: "px-3 py-1.5 text-xs" };
  const variants = {
    primary: "bg-gradient-to-br from-acc to-acc2 text-[#180D02] shadow-[0_4px_14px_rgba(249,115,22,0.35)] hover:-translate-y-px",
    secondary: "bg-s3 text-t2 border border-b1 hover:border-b2 hover:text-t1",
    ghost: "bg-transparent text-t2 hover:text-t1 hover:bg-s2",
    danger: "bg-red/10 text-red border border-red/30 hover:bg-red/20",
    success: "bg-grn/10 text-grn border border-grn/25 hover:bg-grn/20",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Input({ label, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <input
        className="w-full px-3.5 py-2.5 bg-s2 border border-b1 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-2 focus:ring-acc/15 placeholder:text-t3"
        {...props}
      />
    </div>
  );
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <select
        className="w-full px-3.5 py-2.5 bg-s2 border border-b1 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-2 focus:ring-acc/15 cursor-pointer"
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
        <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">{label}</label>
      )}
      <textarea
        className="w-full px-3.5 py-2.5 bg-s2 border border-b1 rounded-lg text-sm text-t1 outline-none transition focus:border-acc focus:ring-2 focus:ring-acc/15 resize-y min-h-[80px] placeholder:text-t3"
        {...props}
      />
    </div>
  );
}

export function Alert({ tone = "error", children }) {
  const tones = {
    error: "bg-red/10 text-red border-red/25",
    success: "bg-grn/10 text-grn border-grn/25",
    info: "bg-blu/10 text-blu border-blu/25",
    warn: "bg-yel/10 text-yel border-yel/25",
  };
  if (!children) return null;
  return <div className={`px-3.5 py-2.5 rounded-lg text-sm mb-4 border ${tones[tone]}`}>{children}</div>;
}

export function Loader({ className = "" }) {
  return (
    <div
      className={`spinner inline-block w-4 h-4 rounded-full border-2 border-white/10 border-t-acc ${className}`}
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
