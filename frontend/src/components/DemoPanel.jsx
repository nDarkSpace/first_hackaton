// filepath: frontend/src/components/DemoPanel.jsx
import { useState } from "react";

const inputStyle = {
  background: "#0d0d1a",
  color: "#fff",
  border: "1px solid #1f3a52",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const btnStyle = {
  background: "#00C4FF",
  color: "#0d0d1a",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

export default function DemoPanel({
  stats,
  achievements,
  submitTx,
  submitDeferred,
  partners,
  pendingCount,
  player,
  onLogout,
}) {
  const [partnerName, setPartnerName] = useState("");
  const [amount, setAmount] = useState("25");
  const [deferred, setDeferred] = useState(false);

  const partner = partners?.find((p) => p.name === partnerName);

  function handlePay(e) {
    e.preventDefault();
    if (!partner) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (deferred) {
      submitDeferred(partner.name, amt, partner.mcc_code);
    } else {
      submitTx(partner.name, amt, partner.mcc_code);
    }
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
          marginBottom: 8,
          fontSize: 11,
          color: "#888",
        }}
      >
        <span>
          {player && (
            <>
              <b style={{ color: "#00C4FF" }}>{player.name}</b> · код:{" "}
              <span style={{ color: "#fff", letterSpacing: 1 }}>{player.recovery_code}</span>
            </>
          )}
        </span>
        <span>
          {pendingCount > 0 && (
            <span
              style={{
                background: "#FFD60A",
                color: "#0d0d1a",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                marginRight: 10,
              }}
              title="Банк прислал транзакции — открой их на карте"
            >
              🔔 {pendingCount}
            </span>
          )}
          Открыто {stats?.unlocked ?? 0}/{stats?.total ?? 0}
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                marginLeft: 10,
                background: "transparent",
                color: "#888",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "inherit",
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
                padding: "2px 8px",
                fontSize: 11,
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
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <select
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
          style={{ ...inputStyle, minWidth: 220, flex: "1 1 220px" }}
          required
        >
          <option value="">— Выбери партнёра —</option>
          {partners?.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} · {p.cashback_percent}%
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...inputStyle, width: 100 }}
          placeholder="BYN"
          required
        />
        <label
          style={{
            fontSize: 11,
            color: deferred ? "#FFD60A" : "#888",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
          title="Оплата произойдёт в фоне. Награду заберёшь позже, открыв игру"
        >
          <input
            type="checkbox"
            checked={deferred}
            onChange={(e) => setDeferred(e.target.checked)}
          />
          travel mode
        </label>
        <button
          type="submit"
          style={{
            ...btnStyle,
            background: deferred ? "#FFD60A" : "#00C4FF",
          }}
          disabled={!partner}
        >
          {deferred ? "Оплатить в фоне" : "Оплатить"}
        </button>
      </form>
    </div>
  );
}
