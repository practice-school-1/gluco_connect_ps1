import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Loader } from "./components/ui";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Alerts from "./pages/Alerts";
import Medications from "./pages/Medications";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";

function RequireAuth({ children }) {
  const { ready, isAuthed } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

function Routed() {
  const { isAuthed, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={ready && isAuthed ? <Navigate to="/overview" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="medications" element={<Medications />} />
        <Route path="notes" element={<Notes />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routed />
      </AuthProvider>
    </BrowserRouter>
  );
}
