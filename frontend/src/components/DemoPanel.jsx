// filepath: frontend/src/components/DemoPanel.jsx
import { useEffect, useRef, useState } from "react";

const inputStyle = {
  background: "#0d0d1a",
  color: "#fff",
  border: "1px solid #1f3a52",
  borderRadius: 10,
  padding: "12px 12px",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
};

const btnStyle = {
  background: "#FFD60A",
  color: "#0d0d1a",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  width: "100%",
  minHeight: 48,
};

export default function DemoPanel({
  stats,
  achievements,
  submitDeferred,
  partners,
  pendingCount,
  player,
  onLogout,
  selectedPartnerName,
}) {
  const [partnerName, setPartnerName] = useState("");
  const [amount, setAmount] = useState("25");
  const amountRef = useRef(null);

  useEffect(() => {
    if (selectedPartnerName && selectedPartnerName !== partnerName) {
      setPartnerName(selectedPartnerName);
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [selectedPartnerName]); // eslint-disable-line react-hooks/exhaustive-deps

  const partner = partners?.find((p) => p.name === partnerName);

  function handlePay(e) {
    e.preventDefault();
    if (!partner) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    submitDeferred(partner.name, amt, partner.mcc_code);
  }

  return (
    <div
      style={{
        background: "#0d0d1a",
        borderTop: "1px solid #00C4FF",
        padding: 12,
        color: "#00C4FF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          fontSize: 12,
          color: "#888",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {player && (
            <>
              <b style={{ color: "#00C4FF" }}>{player.name}</b> · код:{" "}
              <span style={{ color: "#fff", letterSpacing: 1 }}>{player.recovery_code}</span>
            </>
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pendingCount > 0 && (
            <span
              style={{
                background: "#FFD60A",
                color: "#0d0d1a",
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
              }}
              title="Банк прислал транзакции — открой их на карте"
            >
              🔔 {pendingCount}
            </span>
          )}
          <span>{stats?.unlocked ?? 0}/{stats?.total ?? 0}</span>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: "transparent",
                color: "#888",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                padding: "6px 4px",
              }}
            >
              выйти
            </button>
          )}
        </span>
      </div>

      {achievements && achievements.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {achievements.map((a) => (
            <span
              key={a.code}
              title={`${a.name}${a.description ? " — " + a.description : ""}`}
              style={{
                background: "#1a1a2e",
                border: "1px solid #00C4FF",
                borderRadius: 12,
                padding: "3px 10px",
                fontSize: 12,
                color: "#00C4FF",
              }}
            >
              ★ {a.name}
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={handlePay}
        style={{ display: "flex", gap: 8, flexDirection: "column" }}
      >
        <select
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
          style={inputStyle}
          required
        >
          <option value="">— Выбери партнёра —</option>
          {partners?.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} · {p.cashback_percent}%
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={amountRef}
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 120px" }}
            placeholder="BYN"
            required
          />
          <button type="submit" style={btnStyle} disabled={!partner}>
            Оплатить
          </button>
        </div>
      </form>

      <div style={{ fontSize: 11, color: "#666", marginTop: 8, textAlign: "center" }}>
        После оплаты банк пришлёт уведомление — открой территорию на карте
      </div>
    </div>
  );
}
