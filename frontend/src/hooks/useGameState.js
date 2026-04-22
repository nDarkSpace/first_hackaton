// filepath: frontend/src/hooks/useGameState.js
import { useCallback, useEffect, useState } from "react";
import {
  consumePending,
  createPending,
  fetchHexes,
  fetchPartners,
  fetchPending,
  fetchProfile,
  submitTransaction,
} from "../api/client";

export function useGameState(playerId) {
  const [hexes, setHexes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState({ total: 0, unlocked: 0, achievements_count: 0 });
  const [achievements, setAchievements] = useState([]);
  const [notification, setNotification] = useState({ show: false });

  const refresh = useCallback(async () => {
    if (!playerId) return;
    try {
      const [hx, pr, pe] = await Promise.all([
        fetchHexes(playerId),
        fetchProfile(playerId),
        fetchPending(playerId),
      ]);
      setHexes(hx.hexes || []);
      setStats(hx.stats || { total: 0, unlocked: 0, achievements_count: 0 });
      setAchievements(pr.achievements || []);
      setPending(pe.pending || []);
    } catch (e) {
      console.error("refresh failed", e);
    }
  }, [playerId]);

  useEffect(() => {
    refresh();
    fetchPartners()
      .then((d) => setPartners(d.partners || []))
      .catch((e) => console.error("partners failed", e));
  }, [refresh]);

  const submitTx = useCallback(
    async (merchantName, amount, mcc) => {
      if (!playerId) return;
      try {
        const res = await submitTransaction(playerId, mcc, amount, merchantName);
        if (res.hex_unlocked) {
          setHexes((prev) =>
            prev.map((h) =>
              h.hex_id === res.hex_unlocked
                ? { ...h, is_unlocked: true, _justUnlocked: true }
                : h
            )
          );
        }
        setNotification({
          show: true,
          hexUnlocked: res.hex_unlocked,
          reward: res.reward,
          achievements: res.new_achievements || [],
          message: res.message,
        });
        setTimeout(() => setNotification({ show: false }), 4000);
        setTimeout(() => refresh(), 800);
      } catch (e) {
        console.error("submitTx failed", e);
        setNotification({ show: true, error: "Ошибка сети" });
        setTimeout(() => setNotification({ show: false }), 2500);
      }
    },
    [playerId, refresh]
  );

  const submitDeferred = useCallback(
    async (merchantName, amount, mcc) => {
      if (!playerId) return;
      try {
        await createPending(playerId, merchantName, amount, mcc);
        setNotification({
          show: true,
          message: "Транзакция принята банком. Открой игру позже — тебя будет ждать награда 🔔",
        });
        setTimeout(() => setNotification({ show: false }), 3500);
        setTimeout(() => refresh(), 400);
      } catch (e) {
        console.error("submitDeferred failed", e);
        setNotification({ show: true, error: "Ошибка сети" });
        setTimeout(() => setNotification({ show: false }), 2500);
      }
    },
    [playerId, refresh]
  );

  const consume = useCallback(
    async (pendingId) => {
      try {
        const res = await consumePending(pendingId);
        if (res.hex_unlocked) {
          setHexes((prev) =>
            prev.map((h) =>
              h.hex_id === res.hex_unlocked
                ? { ...h, is_unlocked: true, _justUnlocked: true }
                : h
            )
          );
        }
        setNotification({
          show: true,
          hexUnlocked: res.hex_unlocked,
          reward: res.reward,
          achievements: res.new_achievements || [],
        });
        setTimeout(() => setNotification({ show: false }), 4000);
        setTimeout(() => refresh(), 400);
      } catch (e) {
        console.error("consume failed", e);
        setNotification({ show: true, error: "Ошибка сети" });
        setTimeout(() => setNotification({ show: false }), 2500);
      }
    },
    [refresh]
  );

  return { hexes, partners, pending, stats, achievements, notification, submitTx, submitDeferred, consume };
}
