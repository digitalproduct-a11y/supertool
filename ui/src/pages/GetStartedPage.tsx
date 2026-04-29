import { useNavigate } from "react-router-dom";

export function GetStartedPage() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#0d0520" }}
    >
      {/* Gradient blobs */}
      <div
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-40 blur-[120px] animate-blob"
        style={{ background: "#FF3FBF", animationDuration: "18s" }}
      />
      <div
        className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full opacity-35 blur-[100px] animate-blob"
        style={{
          background: "#0055EE",
          animationDelay: "6s",
          animationDuration: "22s",
        }}
      />
      <div
        className="absolute top-10 right-1/4 w-[350px] h-[350px] rounded-full opacity-25 blur-[80px] animate-blob"
        style={{
          background: "#00E5D4",
          animationDelay: "12s",
          animationDuration: "16s",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl animate-fade-slide-up">
        <span className="text-sm font-display font-semibold tracking-[0.2em] uppercase text-white/50 mb-8">
          KULT Digital Kit
        </span>

        <h1 className="font-display text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight">
          Get more done,
          <br />
          every single day.
        </h1>

        <p className="mt-5 text-white/70 text-lg leading-relaxed max-w-xl">
          Your all-in-one toolkit for social content, affiliate marketing, and
          scheduled posts - Made with ♥ by Digital team
        </p>

        <button
          onClick={() => navigate("/home")}
          className="mt-10 px-10 py-4 rounded-full bg-white text-neutral-950 font-display font-bold text-lg
                     hover:scale-[1.03] active:scale-[0.97] transition-transform
                     shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        >
          Let's Go
        </button>
      </div>
    </div>
  );
}
