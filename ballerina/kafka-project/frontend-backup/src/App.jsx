import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AppLayout from "./layouts/AppLayout";
import AuthPage from "./pages/AuthPage";
import RestaurantsPage from "./pages/RestaurantsPage";
import OrderingPage from "./pages/OrderingPage";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";
import KitchenPage from "./pages/KitchenPage";
import DeliveryPage from "./pages/DeliveryPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import RestaurantAdminPage from "./pages/RestaurantAdminPage";
import DriversPage from "./pages/DriversPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import ReportsPage from "./pages/ReportsPage";

function RequireRole({ role }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role)
    return (
      <Navigate
        to={session.role === "admin" ? "/admin" : "/restaurants"}
        replace
      />
    );
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route element={<RequireRole role="customer" />}>
              <Route element={<AppLayout />}>
                <Route path="/restaurants" element={<RestaurantsPage />} />
                <Route path="/order/:restaurantId" element={<OrderingPage />} />
                <Route
                  path="/customer/orders"
                  element={<CustomerOrdersPage />}
                />
              </Route>
            </Route>
            <Route element={<RequireRole role="admin" />}>
              <Route element={<AppLayout mode="admin" />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route
                  path="/admin/restaurants"
                  element={<RestaurantsPage admin />}
                />
                <Route
                  path="/admin/restaurants/:restaurantId"
                  element={<RestaurantAdminPage />}
                />
                <Route path="/admin/drivers" element={<DriversPage />} />
                <Route path="/admin/orders" element={<AdminOrdersPage />} />
                <Route path="/admin/reports" element={<ReportsPage />} />
              </Route>
            </Route>
            <Route element={<AppLayout mode="operations" />}>
              <Route path="/kitchen" element={<RestaurantsPage kitchen />} />
              <Route path="/kitchen/:restaurantId" element={<KitchenPage />} />
              <Route path="/delivery" element={<DeliveryPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
