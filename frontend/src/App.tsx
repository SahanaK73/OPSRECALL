import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import IncidentsList from './pages/IncidentsList';
import SubmitIncident from './pages/SubmitIncident';
import IncidentDetails from './pages/IncidentDetails';
import IncidentAnalysis from './pages/IncidentAnalysis';
import ResolveIncident from './pages/ResolveIncident';
import HistoricalMemory from './pages/HistoricalMemory';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidents" element={<IncidentsList />} />
        <Route path="/incidents/new" element={<SubmitIncident />} />
        <Route path="/incidents/:id" element={<IncidentDetails />} />
        <Route path="/incidents/:id/analysis" element={<IncidentAnalysis />} />
        <Route path="/incidents/:id/resolve" element={<ResolveIncident />} />
        <Route path="/memory" element={<HistoricalMemory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
