import axios from "axios";

const API_URL = "http://20.207.122.201/evaluation-service/logs";
const MAX_LENGTH = 48;

let authToken = "";

export function initLogger(token: string) {
  authToken = token;
}

export async function Log(stack: string, level: string, pkg: string, message: string) {
  const msg = message.length > MAX_LENGTH ? message.slice(0, MAX_LENGTH) : message;

  const response = await axios.post(
    API_URL,
    { stack, level, package: pkg, message: msg },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );

  return response.data;
}
