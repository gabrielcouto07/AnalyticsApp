import { UploadZone } from "../components"

export function WelcomePage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundImage: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "60px 40px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background elements */}
      <div style={{
        position: "absolute",
        width: "400px",
        height: "400px",
        background: "radial-gradient(circle, rgba(79, 142, 247, 0.1) 0%, transparent 70%)",
        borderRadius: "50%",
        top: "-100px",
        right: "-100px",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        width: "300px",
        height: "300px",
        background: "radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)",
        borderRadius: "50%",
        bottom: "-50px",
        left: "-50px",
        pointerEvents: "none"
      }} />

      {/* Content */}
      <div style={{
        maxWidth: "700px",
        textAlign: "center",
        zIndex: 1,
        animation: "fadeInUp 0.6s ease-out"
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-block",
          padding: "8px 16px",
          backgroundColor: "rgba(79, 142, 247, 0.1)",
          border: "1px solid rgba(79, 142, 247, 0.3)",
          borderRadius: "20px",
          marginBottom: "24px",
          fontSize: "13px",
          fontWeight: "600",
          color: "#4f8ef7",
          letterSpacing: "0.5px"
        }}>
          ✨ ANALYTICS PLATFORM
        </div>

        {/* Main headline */}
        <h1 style={{
          fontSize: "56px",
          fontWeight: "800",
          marginBottom: "16px",
          color: "#f1f5f9",
          letterSpacing: "-1px",
          lineHeight: "1.2"
        }}>
          Transform Your Data Into
          <span style={{ color: "#4f8ef7", display: "block", marginTop: "8px" }}>
            Actionable Insights
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "18px",
          color: "#cbd5e1",
          marginBottom: "48px",
          lineHeight: "1.6",
          fontWeight: "400"
        }}>
          Upload your datasets and unlock powerful analytics. Track quality, correlations,
          and patterns in real-time with our intelligent dashboard.
        </p>

        {/* Upload Zone */}
        <div style={{ marginBottom: "40px" }}>
          <UploadZone />
        </div>

        {/* Features grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
          marginTop: "60px",
          paddingTop: "40px",
          borderTop: "1px solid rgba(52, 65, 85, 0.5)"
        }}>
          {[
            { icon: "📊", label: "Real-time", desc: "Live analytics" },
            { icon: "🔍", label: "Deep insights", desc: "Data profiling" },
            { icon: "⚡", label: "Fast processing", desc: "Instant results" }
          ].map((feature, i) => (
            <div key={i} style={{ opacity: 0.9, transition: "opacity 0.3s" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>{feature.icon}</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#f1f5f9", marginBottom: "4px" }}>
                {feature.label}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {feature.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
