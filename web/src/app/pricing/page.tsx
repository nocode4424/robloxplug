"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "10 generations/month",
      "1 active session",
      "Basic script types",
      "Community support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: [
      "Unlimited generations",
      "Script splitting & analysis",
      "Export all scripts",
      "Priority support",
      "Advanced Luau patterns",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/month",
    features: [
      "Everything in Pro",
      "Team sessions (up to 5)",
      "API access",
      "Custom system prompts",
      "Dedicated support",
      "Early access to features",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        padding: "60px 20px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <button
            onClick={() => router.push("/")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Back to StudioAI
          </button>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 8px",
            }}
          >
            Simple pricing
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", margin: 0 }}>
            Start free. Scale as you build.
          </p>
        </motion.div>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: "var(--bg-card)",
                border: plan.popular
                  ? "2px solid var(--accent-purple)"
                  : "1px solid var(--border)",
                borderRadius: 16,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {plan.popular && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--accent-purple)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 14px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  {plan.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, marginBottom: 24 }}>
                {plan.features.map((f) => (
                  <div
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ color: "var(--accent-green)", fontSize: 14 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                style={{
                  width: "100%",
                  background: plan.popular
                    ? "var(--accent-purple)"
                    : "transparent",
                  border: plan.popular
                    ? "none"
                    : "1px solid var(--border-bright)",
                  borderRadius: 10,
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: plan.popular ? "#fff" : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
