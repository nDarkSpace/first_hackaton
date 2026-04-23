// filepath: frontend/src/components/AdminPanel.jsx
import { useEffect, useState } from "react";
import { adminListUsers, adminPush, fetchPartners } from "../api/client";

const wrap = {
  minHeight: "100vh",
  background: "#0d0d1a",
  color: "#fff",
  fontFamily: "inherit",
  padding: 16,
};

const input = {
  background: "#111125",
  color: "#fff",
  border: "1px solid #1f3a52",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};

const btn = {
  background: "#00C4FF",
  color: "#0d0d1a",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export default function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem("fow_admin_token") || "");
  const [authed, setAuthed] = useState(false);
  const [users, setUsers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [err, setErr] = useState("");
  const [log, setLog] = useState([]);

  async function loadAll(t) {
    try {
      const [u, p] = await Promise.all([adminListUsers(t), fetchPartners()]);
      setUsers(u.users || []);
      setPartners(p.partners || []);
      setAuthed(true);
      setErr("");
      localStorage.setItem("fow_admin_token", t);
    } catch (e) {
      setErr(e?.response?.data?.detail ?? "Ошибка доступа");
      setAuthed(false);
    }
  }

  useEffect(() => {
    if (token) loadAll(token);
  }, []);

  async function push(playerId, merchantName, amount, partnerId) {
    try {
      const res = await adminPush(token, playerId, merchantName, amount, partnerId);
      setLog((prev) => [
        `→ ${merchantName} (${amount} BYN) для ${playerId.slice(0, 8)} · ${
          res.created ? "создано" : res.reason
        }`,
        ...prev,
      ].slice(0, 20));
    } catch (e) {
      setLog((prev) => [`ошибка: ${e?.response?.data?.detail ?? "network"}`, ...prev]);
    }
  }

  if (!authed) {
    return (
      <div style={wrap}>
        <h2>Admin</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="admin token"
            style={{ ...input, minWidth: 260 }}
          />
          <button style={btn} onClick={() => loadAll(token)}>
            Войти
          </button>
        </div>
        {err && <div style={{ color: "#ff6b6b", marginTop: 10 }}>{err}</div>}
        <div style={{ color: "#888", marginTop: 14, fontSize: 12 }}>
          Токен задаётся переменной окружения ADMIN_TOKEN на бэкенде (default: demo-admin-token).
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Admin · {users.length} игроков</h2>
        <button
          style={{ ...btn, background: "transparent", color: "#888", border: "1px solid #333" }}
          onClick={() => {
            localStorage.removeItem("fow_admin_token");
            setAuthed(false);
          }}
        >
          выйти
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 20,
        }}
      >
        <div>
          <h3 style={{ color: "#00C4FF" }}>Игроки</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {users.map((u) => (
              <UserRow key={u.player_id} user={u} partners={partners} onPush={push} />
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ color: "#00C4FF" }}>Лог</h3>
          <div
            style={{
              background: "#111125",
              border: "1px solid #222",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              fontFamily: "monospace",
              minHeight: 200,
              whiteSpace: "pre-wrap",
            }}
          >
            {log.length === 0 ? <span style={{ color: "#666" }}>пусто</span> : log.join("\n")}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, partners, onPush }) {
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("25");
  const merchant = partners.find((p) => String(p.id) === merchantId);

  return (
    <div
      style={{
        background: "#111125",
        border: "1px solid #222",
        borderRadius: 8,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{user.name}</div>
        <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>
          {user.recovery_code} · {user.player_id.slice(0, 8)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          style={{ ...input, flex: "1 1 160px", minWidth: 0 }}
        >
          <option value="">— партнёр —</option>
          {partners.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...input, width: 90 }}
        />
        <button
          style={{ ...btn, background: "#FFD60A" }}
          onClick={() => merchant && onPush(user.player_id, merchant.name, amount, merchant.id)}
        >
          🔔 Push
        </button>
      </div>
    </div>
  );
}
