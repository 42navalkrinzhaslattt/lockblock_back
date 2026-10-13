# LockBlock backend

The game server for LockBlock, a skill-based 2D platformer where players pay a small USDC entry deposit and win from a shared reward pool. Deposits and payouts run through Yellow's Nitrolite (ERC-7824) state channels, so a game can start without waiting for an on-chain confirmation.

**Stack:** Node.js · WebSocket (`ws`) · @erc7824/nitrolite · ethers / viem · Polygon · Solidity (Flow EVM)    **Context:** ETHGlobal Prague, 2025 ([showcase](https://ethglobal.com/showcase/lockblock-mxtfh))

## Overview

The browser game talks to this server over a single WebSocket. The server:

1. creates a single-player room for each player (identified by their Ethereum address),
2. prepares a Nitrolite **app session** for the entry deposit, asks the player to sign it and opens the session on Yellow's ClearNode,
3. runs the authoritative game state (position, lives, score, level chunks) while the player sends actions,
4. on game over, settles the reward pool and closes the app session with the final allocations.

The server started from Yellow's "Nitro Aura" tic-tac-toe example (the package is still named `nitro-aura-server`) and was reworked into a single-player platformer backend.

## How it works

### Nitrolite integration: `src/services/nitroliteRPC.js`, `appSessions.js`

- `NitroliteRPCClient` connects to the ClearNode WebSocket (`WS_URL`), authenticates with the server wallet through the `auth_request` → `auth_challenge` → `auth_verify` flow (EIP-712 signed), keeps the connection alive with signed pings, and can query `get_channels`.
- `generateAppSessionMessage` builds an app definition with three participants (player, a second address from `DEFAULT_GUEST_ADDRESS`, server), weights `[0, 0, 100]` and quorum 100, plus USDC allocations. The message is generated once per room with a fixed nonce so every party signs the same request.
- When the room is ready the player gets that request as `appSession:signatureRequest` and signs it back with `appSession:signature`; `createAppSessionWithSignatures` combines the participant signatures with the server's and sends `create_app_session`. The single-player `startGame` path currently opens the session with `createAppSession`, signed by the server alone. At game over `closeAppSession` sends `close_app_session` with the final split: deposit back to the player on a win, to the server side on a loss.
- `nitroliteOnChain.js` sets up viem public/wallet clients for Polygon for on-chain calls.

### Game engine: `src/services/lockBlock.js`

Pure functions over a game state object: 3 lives, a score, and three level chunks (Tutorial, Forest, Mountain) with increasing difficulty. Actions are `move`, `jump`, `interact` (coin / gem / treasure / powerup scoring), `complete_chunk` (+100) and `lose_life` (resets position). The game is won when all chunks are complete and lost at zero lives. Every action is checked against the room's owner address.

### Reward pool: `src/services/rewardPool.js`

A global pool: a loss adds the entry deposit, a win pays out the whole pool and resets it to zero. It also tracks games, wins, losses and win rate.

### Randomness contract: `RandomWTF.sol`

A Solidity contract for Flow EVM that extends `CadenceRandomConsumer` from `@onflow/flow-sol-utils` and exposes `getRandomNumber(min, max)` and `selectRandomItem(items)` using Flow's native on-chain randomness. In the game design this picks which exit of a level is the winning one. It is not called from the Node server.

## WebSocket protocol

All messages are JSON `{ "type": ..., "payload": ... }`.

| Client → server | Payload | Effect |
|---|---|---|
| `joinRoom` | `{ eoa, entryDeposit?, difficulty? }` (omit `roomId` to create) | Creates a room, replies `room:created`, `room:ready` and `appSession:signatureRequest` |
| `appSession:signature` | `{ roomId, signature }` | Stores the player's app-session signature |
| `startGame` | `{ roomId }` | Creates the game state and app session, broadcasts `game:started` and `room:state` |
| `action` | `{ roomId, action: { type, data } }` | Applies a game action, broadcasts `room:state`; on the last one `game:over` |
| `getAvailableRooms` | none | Replies `room:available` |

The server also broadcasts `onlineUsers` (connection count) on connect/disconnect and every 30 s, and sends `error` with a code and message on bad input.

## Build & run

Requires Node.js 20+.

```bash
npm install
cp .env.example .env     # fill in the server wallet key and contract addresses
npm start                # or: npm run dev  (node --watch)
```

The server listens on `PORT` (default 8080). If ClearNode authentication fails it logs the error and keeps serving games without app sessions.

Test scripts:

```bash
node test_lockblock.js      # game engine, reward pool and room manager, no network
node test_client.js         # WebSocket client that plays a winning game against ws://localhost:8080
node test_client_lose.js    # same, losing all three lives
```

## Limitations

Hackathon code, built in a weekend:

- Rooms, game state and the reward pool live in memory and are lost on restart.
- The server trusts the client's actions (`complete_chunk`, `interact` values); there is no physics or replay check.
- Entry deposit validation is a stub, and allocation amounts in the app session are fixed at 0.01 USDC.
- `server.js` still contains a two-player start path (`appSession:startGame`) from the tic-tac-toe template that doesn't match the single-player room shape.

## Project structure

```
src/
  server.js                 WebSocket entry point and message routing
  config/websocket.js       Server setup, error helper, keepalive pings
  routes/roomRoutes.js      joinRoom, getAvailableRooms
  routes/gameRoutes.js      startGame, action, game-over settlement
  services/nitroliteRPC.js  ClearNode client: auth, signing, requests
  services/appSessions.js   Create / sign / close Nitrolite app sessions
  services/lockBlock.js     Game engine
  services/rewardPool.js    Global reward pool
  services/roomManager.js   Rooms and broadcasting
  utils/                    Logger, payload validators
RandomWTF.sol               Flow EVM randomness contract
test_*.js                   Engine test and WebSocket test clients
```

## Team

Built as a team at ETHGlobal Prague 2025. This repo holds the backend; `RandomWTF.sol` was added by teammate neo. The game client is not part of this repository.
