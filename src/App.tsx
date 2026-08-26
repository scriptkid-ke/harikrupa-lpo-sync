import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/hooks/useAuth';
import { RequireAuth, RequirePermission } from '@/components/RouteGuards';
import { AppLayout } from '@/layouts/AppLayout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import LpoList from '@/pages/lpos/LpoList';
import LpoCreate from '@/pages/lpos/LpoCreate';
import LpoDetail from '@/pages/lpos/LpoDetail';
import Customers from '@/pages/customers/Customers';
import Vehicles from '@/pages/vehicles/Vehicles';
import CementCompanies from '@/pages/cement-companies/CementCompanies';
import CementProducts from '@/pages/products/CementProducts';
import NotificationCenter from '@/pages/notifications/NotificationCenter';
import Reports from '@/pages/reports/Reports';
import SettingsPage from '@/pages/settings/Settings';
import Users from '@/pages/users/Users';
import AuditLogs from '@/pages/audit-logs/AuditLogs';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px' } }} />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Dashboard />} />

              <Route path="/lpos" element={<LpoList />} />
              <Route
                path="/lpos/create"
                element={
                  <RequirePermission permission="lpo.create">
                    <LpoCreate />
                  </RequirePermission>
                }
              />
              <Route path="/lpos/:id" element={<LpoDetail />} />

              <Route path="/customers" element={<Customers />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/cement-companies" element={<CementCompanies />} />
              <Route path="/products" element={<CementProducts />} />

              <Route path="/notifications" element={<NotificationCenter />} />
              <Route
                path="/reports"
                element={
                  <RequirePermission permission="reports.view">
                    <Reports />
                  </RequirePermission>
                }
              />

              <Route
                path="/users"
                element={
                  <RequirePermission permission="users.manage">
                    <Users />
                  </RequirePermission>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequirePermission permission="settings.manage">
                    <SettingsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <RequirePermission permission="audit_logs.view">
                    <AuditLogs />
                  </RequirePermission>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
