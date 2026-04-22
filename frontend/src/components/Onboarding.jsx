// filepath: frontend/src/components/Onboarding.jsx
import { useState } from "react";
import { registerPlayer, restorePlayer, setStoredPlayer } from "../api/client";

const wrapStyle = {
  position: "fixed",
  inset: 0,
  background: "#0d0d1a",
  color: "#00C4FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  zIndex: 1000,
};

const cardStyle = {
  background: "#111125",
  border: "1px solid #00C4FF",
  borderRadius: 12,
  padding: 24,
  width: "min(420px, 92vw)",
};

const inputStyle = {
  width: "100%",
  background: "#0d0d1a",
  color: "#fff",
  border: "1px solid #1f3a52",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const btnStyle = {
  background: "#00C4FF",
  color: "#0d0d1a",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghostBtnStyle = {
  ...btnStyle,
  background: "transparent",
  color: "#00C4FF",
  border: "1px solid #00C4FF",
};

export default function Onboarding({ onReady }) {
  const [mode, setMode] = useState("register"); // register | restore
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const player = await registerPlayer(name.trim());
      setStoredPlayer(player);
      onReady(player);
    } catch (e) {
      setErr(e?.response?.data?.detail ?? "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const player = await restorePlayer(code.trim().toUpperCase());
      setStoredPlayer(player);
      onReady(player);
    } catch (e) {
      setErr(e?.response?.data?.detail ?? "Код не найден");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Fog of War · MTBank
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 18 }}>
          Открывай территории Минска покупками у партнёров
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode("register")}
            style={mode === "register" ? btnStyle : ghostBtnStyle}
          >
            Новый профиль
          </button>
          <button
            onClick={() => setMode("restore")}
            style={mode === "restore" ? btnStyle : ghostBtnStyle}
          >
            У меня есть код
          </button>
        </div>

        {mode === "register" ? (
          <form onSubmit={handleRegister}>
            <div style={{ fontSize: 12, color: "#ccc", marginBottom: 6 }}>
              Как тебя зовут?
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Например, Саша"
              style={inputStyle}
              autoFocus
            />
            <button type="submit" disabled={busy} style={{ ...btnStyle, marginTop: 12, width: "100%" }}>
              {busy ? "..." : "Начать"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRestore}>
            <div style={{ fontSize: 12, color: "#ccc", marginBottom: 6 }}>
              Код восстановления (6 символов)
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="AB12CD"
              style={{ ...inputStyle, letterSpacing: 2, textTransform: "uppercase" }}
              autoFocus
            />
            <button type="submit" disabled={busy} style={{ ...btnStyle, marginTop: 12, width: "100%" }}>
              {busy ? "..." : "Войти"}
            </button>
          </form>
        )}

        {err && (
          <div style={{ marginTop: 12, color: "#ff6b6b", fontSize: 12 }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
