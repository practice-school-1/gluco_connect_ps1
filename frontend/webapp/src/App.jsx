import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AlertsProvider } from "./lib/alerts";
import { Loader } from "./components/ui";
import Shell from "./components/Shell";
import Login from "./pages/Login";

import DoctorOverview from "./pages/doctor/Overview";
import DoctorPatients from "./pages/doctor/Patients";
import DoctorPatientDetail from "./pages/doctor/PatientDetail";
import DoctorAlerts from "./pages/doctor/Alerts";
import DoctorMedications from "./pages/doctor/Medications";
import DoctorNotes from "./pages/doctor/Notes";
import DoctorProfile from "./pages/doctor/Profile";

import PatientDashboard from "./pages/patient/Dashboard";
import PatientLogGlucose from "./pages/patient/LogGlucose";
import PatientLogMeal from "./pages/patient/LogMeal";
import PatientLogActivity from "./pages/patient/LogActivity";
import PatientMedications from "./pages/patient/Medications";
import PatientInsights from "./pages/patient/Insights";
import PatientNotes from "./pages/patient/Notes";
import PatientHistory from "./pages/patient/History";
import PatientProfile from "./pages/patient/Profile";

function FullscreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Loader />
    </div>
  );
}

function RequireRole({ role, children }) {
  const { ready, isAuthed, role: currentRole } = useAuth();
  if (!ready) return <FullscreenLoader />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (currentRole !== role) return <Navigate to={currentRole === "doctor" ? "/doctor/overview" : "/patient/dashboard"} replace />;
  return children;
}

function Routed() {
  const { ready, isAuthed, role } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          ready && isAuthed ? (
            <Navigate to={role === "doctor" ? "/doctor/overview" : "/patient/dashboard"} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/doctor"
        element={
          <RequireRole role="doctor">
            <AlertsProvider>
              <Shell />
            </AlertsProvider>
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<DoctorOverview />} />
        <Route path="patients" element={<DoctorPatients />} />
        <Route path="patients/:id" element={<DoctorPatientDetail />} />
        <Route path="alerts" element={<DoctorAlerts />} />
        <Route path="medications" element={<DoctorMedications />} />
        <Route path="notes" element={<DoctorNotes />} />
        <Route path="profile" element={<DoctorProfile />} />
      </Route>

      <Route
        path="/patient"
        element={
          <RequireRole role="patient">
            <Shell />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="log-glucose" element={<PatientLogGlucose />} />
        <Route path="log-meal" element={<PatientLogMeal />} />
        <Route path="log-activity" element={<PatientLogActivity />} />
        <Route path="medications" element={<PatientMedications />} />
        <Route path="insights" element={<PatientInsights />} />
        <Route path="notes" element={<PatientNotes />} />
        <Route path="history" element={<PatientHistory />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>

      <Route
        path="/"
        element={
          !ready ? (
            <FullscreenLoader />
          ) : !isAuthed ? (
            <Navigate to="/login" replace />
          ) : (
            <Navigate to={role === "doctor" ? "/doctor/overview" : "/patient/dashboard"} replace />
          )
        }
      />
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
