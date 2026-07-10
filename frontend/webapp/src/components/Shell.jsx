import { NavLink, Outlet, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAlerts } from "../lib/alerts";
import { Button } from "./ui";

const NAV_DOCTOR = [
  { section: "Dashboard", items: [
    { to: "/doctor/overview", icon: "⬡", label: "Overview" },
    { to: "/doctor/patients", icon: "👥", label: "Patients" },
  ]},
  { section: "Clinical", items: [
    { to: "/doctor/alerts", icon: "⚠", label: "Alerts", badge: true },
    { to: "/doctor/medications", icon: "💊", label: "Medications" },
    { to: "/doctor/notes", icon: "📝", label: "Notes" },
  ]},
  { section: "Account", items: [
    { to: "/doctor/profile", icon: "👤", label: "Profile" },
  ]},
];

const NAV_PATIENT = [
  { section: "Health", items: [
    { to: "/patient/dashboard", icon: "⬡", label: "Dashboard" },
    { to: "/patient/log-glucose", icon: "🩸", label: "Log glucose" },
    { to: "/patient/log-meal", icon: "🍽", label: "Log meal" },
    { to: "/patient/log-activity", icon: "🏃", label: "Log activity" },
  ]},
  { section: "My data", items: [
    { to: "/patient/medications", icon: "💊", label: "Medications" },
    { to: "/patient/insights", icon: "✦", label: "Insights" },
    { to: "/patient/notes", icon: "📝", label: "Doctor notes" },
    { to: "/patient/history", icon: "📋", label: "History" },
  ]},
  { section: "Account", items: [
    { to: "/patient/profile", icon: "👤", label: "Profile" },
  ]},
];

function AlertBadge() {
  const { count } = useAlerts();
  if (count <= 0) return null;
  return <span className="ml-auto bg-red text-white rounded-full text-[10px] font-bold px-1.5 py-px">{count}</span>;
}

export default function Shell() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const name = profile?.full_name || (role === "doctor" ? "Doctor" : "Patient");
  const nav = role === "doctor" ? NAV_DOCTOR : NAV_PATIENT;
  const profilePath = role === "doctor" ? "/doctor/profile" : "/patient/profile";

  if (role === "patient" && !profile?.full_name && location.pathname !== profilePath) {
    return <Navigate to={profilePath} replace />;
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-6 bg-bg2 border-b border-navyb">
        <div className="flex items-center gap-2.5 font-bold text-sm text-white">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-acc to-acc2 flex items-center justify-center font-extrabold text-xs text-white">
            G
          </div>
          GlucoConnect
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50 border border-white/15 rounded-full px-2 py-0.5 ml-1">
            {role === "doctor" ? "Clinician" : "Patient"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-white/60 hidden sm:inline">{name}</span>
          <NavLink
            to={profilePath}
            className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white font-bold text-[13px] flex items-center justify-center"
          >
            {name[0]?.toUpperCase()}
          </NavLink>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 shrink-0 bg-bg2 border-r border-navyb p-3 hidden md:flex flex-col gap-0.5">
          {nav.map((group) => (
            <div key={group.section}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/35 px-2.5 pt-2.5 pb-1 mt-1">
                {group.section}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-[13.5px] rounded-lg font-medium transition-all ${
                      isActive ? "text-white bg-white/10 font-semibold" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <span className="w-5 text-center text-sm">{item.icon}</span>
                  {item.label}
                  {item.badge && <AlertBadge />}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>
        <main className="flex-1 px-6 py-8 pb-16 max-w-[1100px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-7 flex items-start justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-t1">{title}</h1>
        {subtitle && <p className="text-sm text-t2 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
