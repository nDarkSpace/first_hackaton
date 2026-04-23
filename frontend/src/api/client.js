// filepath: frontend/src/api/client.js
import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL, timeout: 10000 });

const LS_KEY = "fow_player";

export function getStoredPlayer() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredPlayer(player) {
  localStorage.setItem(LS_KEY, JSON.stringify(player));
}

export function clearStoredPlayer() {
  localStorage.removeItem(LS_KEY);
}

export async function registerPlayer(name) {
  const res = await api.post("/api/auth/register", { name });
  return res.data;
}

export async function restorePlayer(recoveryCode) {
  const res = await api.post("/api/auth/restore", { recovery_code: recoveryCode });
  return res.data;
}

export async function fetchMe(playerId) {
  const res = await api.get(`/api/auth/me/${playerId}`);
  return res.data;
}

export async function fetchHexes(playerId) {
  const res = await api.get(`/api/hexes/${playerId}`);
  return res.data;
}

export async function fetchPartners() {
  const res = await api.get("/api/partners");
  return res.data;
}

export async function submitTransaction(playerId, mcc, amount, merchantName, partnerId) {
  const res = await api.post("/api/transaction", {
    player_id: playerId,
    merchant_name: merchantName,
    mcc_code: mcc,
    amount: Number(amount),
    currency: "BYN",
    timestamp: new Date().toISOString(),
    partner_id: partnerId ?? null,
  });
  return res.data;
}

export async function fetchPending(playerId) {
  const res = await api.get(`/api/pending/${playerId}`);
  return res.data;
}

export async function createPending(playerId, merchantName, amount, mcc, partnerId) {
  const res = await api.post("/api/pending", {
    player_id: playerId,
    merchant_name: merchantName,
    amount: Number(amount),
    mcc_code: mcc,
    partner_id: partnerId ?? null,
  });
  return res.data;
}

export async function consumePending(pendingId) {
  const res = await api.post(`/api/pending/${pendingId}/consume`);
  return res.data;
}

export async function adminListUsers(token) {
  const res = await api.get("/api/admin/users", { headers: { "X-Admin-Token": token } });
  return res.data;
}

export async function adminPush(token, playerId, merchantName, amount, partnerId) {
  const res = await api.post(
    "/api/admin/push",
    {
      player_id: playerId,
      merchant_name: merchantName,
      amount: Number(amount),
      partner_id: partnerId ?? null,
    },
    { headers: { "X-Admin-Token": token } }
  );
  return res.data;
}

export async function fetchProfile(playerId) {
  const res = await api.get(`/api/player/${playerId}/profile`);
  return res.data;
}

export async function fetchRewards(playerId) {
  const res = await api.get(`/api/rewards/${playerId}`);
  return res.data;
}

export async function useReward(rewardId) {
  const res = await api.post(`/api/rewards/${rewardId}/use`);
  return res.data;
}

export default api;
