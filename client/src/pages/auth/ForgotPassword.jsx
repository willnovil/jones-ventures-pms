import { Link } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout";

// Stub: actual password reset emails ship in Phase 2 (Resend integration).
// For now this just acknowledges the request — better than a broken link.
export default function ForgotPassword() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Email-based password reset ships in the next phase"
      footer={
        <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">
          ← Back to sign in
        </Link>
      }
    >
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        Password reset by email is coming with the notifications phase. For
        now, contact support if you can't sign in.
      </div>
    </AuthLayout>
  );
}
