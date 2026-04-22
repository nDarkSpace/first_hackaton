// filepath: frontend/src/App.jsx
import { useEffect, useState } from "react";
import GameMap from "./components/GameMap";
import DemoPanel from "./components/DemoPanel";
import NotificationToast from "./components/NotificationToast";
import Onboarding from "./components/Onboarding";
import AdminPanel from "./components/AdminPanel";
import { useGameState } from "./hooks/useGameState";
import { clearStoredPlayer, fetchMe, getStoredPlayer, setStoredPlayer } from "./api/client";

export default function App() {
  const [player, setPlayer] = useState(null);
  const [bootDone, setBootDone] = useState(false);
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  useEffect(() => {
    const stored = getStoredPlayer();
    if (!stored) {
      setBootDone(true);
      return;
    }
    fetchMe(stored.player_id)
      .then((p) => {
        setStoredPlayer(p);
        setPlayer(p);
      })
      .catch(() => {
        clearStoredPlayer();
      })
      .finally(() => setBootDone(true));
  }, []);

  const {
    hexes, partners, pending, stats, achievements, notification,
    submitTx, submitDeferred, consume,
  } = useGameState(player?.player_id);

  function handleLogout() {
    clearStoredPlayer();
    setPlayer(null);
  }

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  if (!bootDone) {
    return (
      <div style={{ height: "100vh", background: "#0d0d1a", color: "#00C4FF",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        Загрузка...
      </div>
    );
  }

  if (!player) {
    return <Onboarding onReady={setPlayer} />;
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d0d1a",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <GameMap hexes={hexes} partners={partners} pending={pending} onConsume={consume} />
        <NotificationToast notification={notification} />
      </div>
      <DemoPanel
        stats={stats}
        achievements={achievements}
        partners={partners}
        pendingCount={pending?.length ?? 0}
        submitTx={submitTx}
        submitDeferred={submitDeferred}
        player={player}
        onLogout={handleLogout}
      />
    </div>
  );
}
