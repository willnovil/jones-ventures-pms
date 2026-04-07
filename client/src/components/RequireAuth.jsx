import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../lib/auth";
import LoadingSpinner from "./LoadingSpinner";

// Guards a route subtree: redirects to /login if there's no session,
// otherwise renders the children. While the session check is pending,
// shows a centered spinner so we don't flash the login page.
export default function RequireAuth({ children }) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
