import { useNavigate } from "react-router-dom";
import { IconChevronLeft } from "@tabler/icons-react";

// Placeholder page — Prime Talk is wired into the router and sidebar but the
// real flow is still being built. Renders a "Coming soon" panel so staging
// builds pass without compiling errors.
export function PrimeTalkPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/engagement-posts")}
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 transition mb-6"
        >
          <IconChevronLeft className="w-4 h-4" />
          Back to engagement posts
        </button>
        <div className="glass-card rounded-2xl p-12 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
            Prime Talk
          </h1>
          <p className="text-sm text-neutral-500">
            This tool is coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
