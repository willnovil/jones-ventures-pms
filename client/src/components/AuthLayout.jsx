// Centered card layout shared by Login / Signup / ForgotPassword / ResetPassword.
// Renders the app brand on top and a card for whatever form the page passes in.

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base mb-3">
            PM
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jones Ventures</h1>
          <p className="text-sm text-gray-500 mt-1">Property Management</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1 mb-5">{subtitle}</p>}
          {!subtitle && <div className="mb-5" />}
          {children}
        </div>
        {footer && (
          <div className="text-center mt-4 text-sm text-gray-600">{footer}</div>
        )}
      </div>
    </div>
  );
}
