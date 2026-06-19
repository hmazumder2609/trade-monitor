/**
 * SnapTrade API proxy route.
 * Proxies requests to the SnapTrade API, handling signature generation server-side.
 * API: https://api.snaptrade.com/api/v1
 */
import { createHmac } from 'node:crypto';
import { readEnvKey, writeEnvKeys } from './settings';

const SNAPTRADE_API = 'https://api.snaptrade.com/api/v1';

/** Replicate the SDK's JSONstringifyOrder: JSON.stringify with globally sorted keys. */
function jsonStringifySorted(obj: unknown): string {
  const allKeys: string[] = [];
  const seen: Record<string, boolean> = {};
  JSON.stringify(obj, (_key, value) => {
    if (typeof _key === 'string' && !(_key in seen)) {
      allKeys.push(_key);
      seen[_key] = true;
    }
    return value;
  });
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

function generateSignature(
  consumerKey: string,
  requestPath: string,
  query: string,
  body: Record<string, unknown> | null
): string {
  const sigObject = { content: body, path: requestPath, query };
  const sigContent = jsonStringifySorted(sigObject);
  const encodedKey = encodeURI(consumerKey);
  return createHmac('sha256', encodedKey).update(sigContent).digest('base64');
}

async function snapRequest(
  method: string,
  path: string,
  clientId: string,
  consumerKey: string,
  userId?: string,
  userSecret?: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestPath = `/api/v1${path.split('?')[0]}`;

  // Build query string in the SAME order as the SnapTrade SDK so the HMAC
  // signature (which is computed over the query string) matches what the
  // server expects: clientId, timestamp, then any extra params (userId, userSecret, etc).
  const extraQuery = path.includes('?') ? path.split('?')[1] : '';
  const query = `clientId=${encodeURIComponent(clientId)}&timestamp=${timestamp}${extraQuery ? `&${extraQuery}` : ''}`;

  const requestBody = body && Object.keys(body).length > 0 ? body : null;
  const signature = generateSignature(consumerKey, requestPath, query, requestBody);

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Signature: signature,
  };

  if (userId) reqHeaders['userId'] = userId;
  if (userSecret) reqHeaders['userSecret'] = userSecret;

  const url = `${SNAPTRADE_API}${path.split('?')[0]}?${query}`;
  const bodyStr = requestBody ? JSON.stringify(requestBody) : undefined;
  const resp = await fetch(url, {
    method,
    headers: reqHeaders,
    body: method !== 'GET' ? bodyStr : undefined,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`SnapTrade ${resp.status}: ${errText}`);
  }

  return resp.json();
}

export async function handleSnapTradeRequest(
  query: Record<string, string>,
  body: string,
  headers: Record<string, string | string[] | undefined>
): Promise<unknown> {
  const subPath = query.__path || '';
  const clientId = (headers['x-snaptrade-clientid'] as string) || '';
  const userId = (headers['x-snaptrade-userid'] as string) || '';
  const userSecret = (headers['x-snaptrade-usersecret'] as string) || '';
  // Prefer request headers (from frontend localStorage), fall back to .env file.
  // readEnvKey also falls back to process.env, so both cold-start and post-save work.
  const effectiveConsumerKey =
    (headers['x-snaptrade-consumerkey'] as string) || readEnvKey('SNAPTRADE_CONSUMER_KEY');
  const effectiveClientId = clientId || readEnvKey('SNAPTRADE_CLIENT_ID');

  if (!effectiveClientId) {
    throw new Error('Missing SnapTrade clientId — set SNAPTRADE_CLIENT_ID in .env or Settings');
  }
  if (!effectiveConsumerKey) {
    throw new Error(
      'Missing SnapTrade consumerKey — set SNAPTRADE_CONSUMER_KEY in .env or Settings'
    );
  }

  let parsedBody: Record<string, unknown> = {};
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch {}
  }

  // Resolve user credentials: prefer request headers, fall back to .env-stored user.
  // SnapTrade "personal keys" can only register ONE user, so we persist userId+userSecret
  // in .env and reuse them across sessions.
  const storedUserId = readEnvKey('SNAPTRADE_USER_ID');
  const storedUserSecret = readEnvKey('SNAPTRADE_USER_SECRET');
  const effectiveUserId = userId || storedUserId;
  const effectiveUserSecret = userSecret || storedUserSecret;

  // Helper: register a fresh user and persist credentials to .env
  async function doRegister(requestedUserId: string) {
    const result = (await snapRequest(
      'POST',
      '/snapTrade/registerUser',
      effectiveClientId,
      effectiveConsumerKey,
      undefined,
      undefined,
      { userId: requestedUserId }
    )) as { userId?: string; userSecret?: string };
    if (result?.userId && result?.userSecret) {
      writeEnvKeys({
        SNAPTRADE_USER_ID: result.userId,
        SNAPTRADE_USER_SECRET: result.userSecret,
      });
    }
    return result;
  }

  // Route based on subPath
  if (subPath === '/listUsers') {
    return snapRequest('GET', '/snapTrade/listUsers', effectiveClientId, effectiveConsumerKey);
  }

  if (subPath === '/deleteUser') {
    const targetUserId = (parsedBody.userId as string) || effectiveUserId;
    if (!targetUserId) throw new Error('deleteUser requires userId');
    const result = await snapRequest(
      'DELETE',
      `/snapTrade/deleteUser?userId=${encodeURIComponent(targetUserId)}`,
      effectiveClientId,
      effectiveConsumerKey
    );
    // Clear stored credentials if we just deleted the stored user
    if (targetUserId === storedUserId) {
      writeEnvKeys({ SNAPTRADE_USER_ID: '', SNAPTRADE_USER_SECRET: '' });
    }
    return result;
  }

  if (subPath === '/register') {
    // If a user is already registered (stored in .env), return those credentials
    // instead of re-registering — personal keys reject a second registration.
    if (storedUserId && storedUserSecret) {
      return { userId: storedUserId, userSecret: storedUserSecret, reused: true };
    }
    const requestedUserId = (parsedBody.userId as string) || `mdm-user-${Date.now()}`;
    try {
      return await doRegister(requestedUserId);
    } catch (err: any) {
      const msg = err?.message || '';
      // 1012: personal key already has a user, but we don't know the secret.
      // Auto-recover: list users, delete all orphans, and re-register fresh.
      if (msg.includes('1012') || msg.includes('Personal keys can only register one user')) {
        try {
          const users = (await snapRequest(
            'GET',
            '/snapTrade/listUsers',
            effectiveClientId,
            effectiveConsumerKey
          )) as string[];
          if (Array.isArray(users)) {
            for (const u of users) {
              await snapRequest(
                'DELETE',
                `/snapTrade/deleteUser?userId=${encodeURIComponent(u)}`,
                effectiveClientId,
                effectiveConsumerKey
              );
            }
          }
          // Quota propagation is async on SnapTrade's side — retry register
          // a few times with a short delay until the quota frees up.
          let lastErr: any = null;
          for (const delayMs of [1500, 2500, 4000, 6000]) {
            await new Promise(res => setTimeout(res, delayMs));
            try {
              const fresh = await doRegister(requestedUserId);
              return {
                ...fresh,
                recovered: true,
                deletedOrphans: Array.isArray(users) ? users : [],
              };
            } catch (e: any) {
              lastErr = e;
              if (!(e?.message || '').includes('1012')) throw e;
            }
          }
          throw lastErr || new Error('Timed out waiting for SnapTrade to free the user quota');
        } catch (recoverErr: any) {
          throw new Error(
            'SnapTrade personal key already has a registered user, and auto-recovery failed: ' +
              (recoverErr?.message || 'unknown error') +
              '. Try deleting the user manually at https://dashboard.snaptrade.com.'
          );
        }
      }
      throw err;
    }
  }

  if (subPath === '/connect') {
    const loginQuery = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    const loginBody: Record<string, unknown> = {
      connectionType: parsedBody.connectionType || 'trade',
    };
    if (parsedBody.redirectUri) loginBody.customRedirect = parsedBody.redirectUri;

    const reconnectVal = parsedBody.reconnect;
    if (reconnectVal === true) {
      const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
      const auths = (await snapRequest(
        'GET',
        `/authorizations?${q}`,
        effectiveClientId,
        effectiveConsumerKey,
        effectiveUserId,
        effectiveUserSecret
      )) as Array<{ id?: string; brokerage_authorization_id?: string; connection_type?: string }>;
      // Find read-only connection to reconnect with trade permissions
      const readOnlyAuth = auths?.find((a: any) => a.connection_type === 'read');
      if (readOnlyAuth) {
        loginBody.reconnect = readOnlyAuth.brokerage_authorization_id || readOnlyAuth.id;
      } else if (auths && auths.length > 0) {
        loginBody.reconnect = auths[0].brokerage_authorization_id || auths[0].id;
      }
    } else if (typeof reconnectVal === 'string' && reconnectVal.length > 0) {
      loginBody.reconnect = reconnectVal;
    }

    if (parsedBody.broker) loginBody.broker = parsedBody.broker;
    return snapRequest(
      'POST',
      `/snapTrade/login?${loginQuery}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      loginBody
    );
  }

  // GET /authorizations — list all brokerage authorizations with their type
  // (read vs trade) and disabled status. Used to detect permission level.
  if (subPath === '/authorizations') {
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'GET',
      `/authorizations?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  if (subPath === '/accounts') {
    return snapRequest(
      'GET',
      `/accounts?userId=${effectiveUserId}&userSecret=${effectiveUserSecret}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  // /accounts/:id/holdings
  const holdingsMatch = subPath.match(/^\/accounts\/([^/]+)\/holdings$/);
  if (holdingsMatch) {
    const accountId = holdingsMatch[1];
    return snapRequest(
      'GET',
      `/accounts/${accountId}/holdings?userId=${effectiveUserId}&userSecret=${effectiveUserSecret}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  // /accounts/:id/orders — order/trade history for an account
  const ordersMatch = subPath.match(/^\/accounts\/([^/]+)\/orders$/);
  if (ordersMatch) {
    const accountId = ordersMatch[1];
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'GET',
      `/accounts/${accountId}/orders?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  // /accounts/:id/balances — detailed cash + buying power per currency
  const balancesMatch = subPath.match(/^\/accounts\/([^/]+)\/balances$/);
  if (balancesMatch) {
    const accountId = balancesMatch[1];
    return snapRequest(
      'GET',
      `/accounts/${accountId}/balances?userId=${effectiveUserId}&userSecret=${effectiveUserSecret}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  // POST /trade/impact — check order impact (real SnapTrade endpoint)
  if (subPath === '/trade/impact') {
    const tradeQuery = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'POST',
      `/trade/impact?${tradeQuery}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      parsedBody
    );
  }

  // POST /trade/{tradeId} — place a previously checked impact order
  const placeMatch = subPath.match(/^\/trade\/([^/]+)\/place$/);
  if (placeMatch) {
    const tradeId = placeMatch[1];
    const tradeQuery = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'POST',
      `/trade/${tradeId}?${tradeQuery}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      parsedBody
    );
  }

  // GET /options/chain?accountId=X&symbol=Y — fetch the options chain for a
  // universal symbol on a connected brokerage account. SnapTrade returns the
  // expiration ladder + strike grid, with separate call/put symbol IDs per strike.
  if (subPath === '/options/chain') {
    const accountId = query.accountId || '';
    const symbol = query.symbol || '';
    if (!accountId || !symbol) throw new Error('options/chain requires accountId and symbol');
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}&symbol=${encodeURIComponent(symbol)}`;
    return snapRequest(
      'GET',
      `/accounts/${accountId}/optionsChain?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret
    );
  }

  // POST /options/strategy?accountId=X — build (or look up) an option strategy,
  // returning a strategy id + quote that can subsequently be executed.
  if (subPath === '/options/strategy') {
    const accountId = query.accountId || '';
    if (!accountId) throw new Error('options/strategy requires accountId');
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'POST',
      `/accounts/${accountId}/optionStrategy?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      parsedBody
    );
  }

  // POST /options/execute?accountId=X&strategyId=Y — actually place the previously
  // built option strategy at the broker.
  if (subPath === '/options/execute') {
    const accountId = query.accountId || '';
    const strategyId = query.strategyId || '';
    if (!accountId || !strategyId)
      throw new Error('options/execute requires accountId and strategyId');
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'POST',
      `/accounts/${accountId}/optionStrategy/${strategyId}/execute?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      parsedBody
    );
  }

  // POST /symbols/searchAccount?accountId=X — account-aware symbol lookup,
  // returns universal_symbol_id needed for /trade/impact
  if (subPath === '/symbols/searchAccount') {
    const accountId = query.accountId || '';
    const substring = query.q || '';
    if (!accountId) throw new Error('searchAccount requires accountId');
    const q = `userId=${encodeURIComponent(effectiveUserId)}&userSecret=${encodeURIComponent(effectiveUserSecret)}`;
    return snapRequest(
      'POST',
      `/accounts/${accountId}/symbols?${q}`,
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      { substring }
    );
  }

  // POST /symbols — global universal symbol search
  if (subPath.startsWith('/symbols/search')) {
    const searchQuery = query.query || '';
    return snapRequest(
      'POST',
      '/symbols',
      effectiveClientId,
      effectiveConsumerKey,
      effectiveUserId,
      effectiveUserSecret,
      {
        substring: searchQuery,
      }
    );
  }

  throw new Error(`Unknown SnapTrade endpoint: ${subPath}`);
}
