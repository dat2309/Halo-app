import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth-token';

export type TokenType = {
  access: string;
  refresh: string;
};

export async function getToken(): Promise<TokenType | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TokenType;
  } catch {
    return null;
  }
}

export async function setToken(value: TokenType): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(value));
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
