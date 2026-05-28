// Animated skeleton placeholder shown while data is loading

export function LoadingSkeleton() {
  const skeletonStyle = {
    borderRadius: "14px",
    border: "1px solid #334155",
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* KPI Cards Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px"
      }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              ...skeletonStyle,
              padding: "20px",
              height: "128px"
            }}
          />
        ))}
      </div>

      {/* Large Chart */}
      <div
        style={{
          ...skeletonStyle,
          height: "256px",
          padding: "16px"
        }}
      />

      {/* Two Column Charts */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "16px"
      }}>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            style={{
              ...skeletonStyle,
              height: "192px",
              padding: "16px"
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4 }
          50% { opacity: 0.7 }
        }
      `}</style>
    </div>
  )
}
