import { io } from "socket.io-client";
const tokenKey = "catan-session-v2";
let token = sessionStorage.getItem(tokenKey);
if (!token) {
  token = crypto.randomUUID();
  sessionStorage.setItem(tokenKey, token);
}
export const socket = io({ auth: { token }, autoConnect: true });
