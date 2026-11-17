import { io } from "socket.io-client";
const tokenKey = "catan-session-v2";
let token = sessionStorage.getItem(tokenKey);
if (!token) {
  token = crypto.randomUUID();
  sessionStorage.setItem(tokenKey, token);
}
export function saveAccountToken(value: string | null) {
  if (value) sessionStorage.setItem("catan-account-session", value);
  else sessionStorage.removeItem("catan-account-session");
}
export const socket = io({
  auth: (done) =>
    done({
      token,
      accountToken: sessionStorage.getItem("catan-account-session"),
    }),
  autoConnect: true,
});
