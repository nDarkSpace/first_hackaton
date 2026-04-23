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
  rewards,
  onRedeem,
  submitDeferred,
  partners,
  pendingCount,
  player,
  onLogout,
  selectedPartner,
}) {
  const [partnerId, setPartnerId] = useState("");
  const [amount, setAmount] = useState("25");
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const amountRef = useRef(null);
  const activeRewards = rewards?.active ?? [];

  useEffect(() => {
    if (selectedPartner?.id != null && String(selectedPartner.id) !== partnerId) {
      setPartnerId(String(selectedPartner.id));
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [selectedPartner]); // eslint-disable-line react-hooks/exhaustive-deps

  const partner = partners?.find((p) => String(p.id) === partnerId);

  function handlePay(e) {
    e.preventDefault();
    if (!partner) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    submitDeferred(partner.name, amt, partner.mcc_code, partner.id);
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
          {activeRewards.length > 0 && (
            <button
              onClick={() => setRewardsOpen((v) => !v)}
              style={{
                background: "#7B61FF",
                color: "#fff",
                border: "none",
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              title="Активные промокоды"
            >
              🎁 {activeRewards.length}
            </button>
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
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          style={inputStyle}
          required
        >
          <option value="">— Выбери партнёра —</option>
          {partners?.map((p) => (
            <option key={p.id} value={String(p.id)}>
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

      {rewardsOpen && (
        <div
          style={{
            marginTop: 10,
            background: "#111125",
            border: "1px solid #7B61FF",
            borderRadius: 10,
            padding: 10,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>
            Активные промокоды
          </div>
          {activeRewards.length === 0 && (
            <div style={{ fontSize: 12, color: "#666" }}>Пусто</div>
          )}
          {activeRewards.map((r) => {
            const expDays = Math.max(
              0,
              Math.ceil((new Date(r.expires_at) - new Date()) / 86400000)
            );
            return (
              <div
                key={r.id}
                style={{
                  borderBottom: "1px solid #1f1f33",
                  padding: "8px 0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>
                    {r.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "#7B61FF",
                      letterSpacing: 1,
                    }}
                  >
                    {r.code}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    осталось {expDays} дн.
                  </div>
                </div>
                <button
                  onClick={() => onRedeem && onRedeem(r.id)}
                  style={{
                    background: "transparent",
                    color: "#7B61FF",
                    border: "1px solid #7B61FF",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  использовать
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
