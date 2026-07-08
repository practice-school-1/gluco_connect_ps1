import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui";

const NAV = [
  { section: "Dashboard", items: [
    { to: "/overview", icon: "⬡", label: "Overview" },
    { to: "/patients", icon: "👥", label: "Patients" },
  ]},
  { section: "Clinical", items: [
    { to: "/alerts", icon: "⚠", label: "Alerts" },
    { to: "/medications", icon: "💊", label: "Medications" },
    { to: "/notes", icon: "📝", label: "Notes" },
  ]},
  { section: "Account", items: [
    { to: "/profile", icon: "👤", label: "Profile" },
  ]},
];

export default function Shell() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || "Doctor";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-6 bg-bg/85 backdrop-blur-md border-b border-b1">
        <div className="flex items-center gap-2.5 font-bold text-sm">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-acc to-acc2 text-[#180D02] flex items-center justify-center font-extrabold text-xs">
            G
          </div>
          GlucoConnect — Doctor
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-t2 hidden sm:inline">{name}</span>
          <NavLink
            to="/profile"
            className="w-8 h-8 rounded-full bg-acc/10 border border-acc/25 text-acc font-bold text-[13px] flex items-center justify-center"
          >
            {name[0]?.toUpperCase()}
          </NavLink>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 shrink-0 bg-bg2 border-r border-b1 p-3 hidden md:flex flex-col gap-0.5">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 px-2.5 pt-2.5 pb-1 mt-1">
                {group.section}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-[13.5px] rounded-lg font-medium transition-all ${
                      isActive ? "text-acc bg-acc/10 font-semibold" : "text-t2 hover:text-t1 hover:bg-s2"
                    }`
                  }
                >
                  <span className="w-5 text-center text-sm">{item.icon}</span>
                  {item.label}
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
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-t2 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
