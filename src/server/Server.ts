import express, { json } from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { GameManager } from "./GameManager";
import {
  ClientMessage,
  ClientMessageSchema,
  GameRecord,
  GameRecordSchema,
  LogSeverity,
} from "../core/Schemas";
import { getConfig, getServerConfig } from "../core/configuration/Config";
import { slog } from "./StructuredLog";
import { Client } from "./Client";
import { GamePhase, GameServer } from "./GameServer";
import { archive } from "./Archive";
import { DiscordBot } from "./DiscordBot";
import {
  sanitizeUsername,
  validateUsername,
} from "../core/validations/username";
import { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the 'out' directory
app.use(express.static(path.join(__dirname, "../../out")));
app.use(express.json());

const gm = new GameManager(getServerConfig());

const bot = new DiscordBot();
try {
  await bot.start();
} catch (error) {
  console.error("Failed to start bot:", error);
}

let lobbiesString = "";

// New GET endpoint to list lobbies
app.get("/lobbies", (req: Request, res: Response) => {
  res.send(lobbiesString);
});

app.post("/private_lobby", (req, res) => {
  const id = gm.createPrivateGame();
  console.log("creating private lobby with id ${id}");
  res.json({
    id: id,
  });
});

app.post("/archive_singleplayer_game", (req, res) => {
  try {
    const gameRecord: GameRecord = req.body;
    const clientIP = req.ip || req.socket.remoteAddress || "unknown"; // Added this line

    if (!gameRecord) {
      console.log("game record not found in request");
      res.status(404).json({ error: "Game record not found" });
      return;
    }
    gameRecord.players.forEach((p) => (p.ip = clientIP));
    GameRecordSchema.parse(gameRecord);
    archive(gameRecord);
    res.json({
      success: true,
    });
  } catch (error) {
    slog({
      logKey: "complete_single_player_game_record",
      msg: `Failed to complete game record: ${error}`,
      severity: LogSeverity.Error,
    });
    res.status(400).json({ error: "Invalid game record format" });
  }
});

app.post("/start_private_lobby/:id", (req, res) => {
  console.log(`starting private lobby with id ${req.params.id}`);
  gm.startPrivateGame(req.params.id);
});

app.put("/private_lobby/:id", (req, res) => {
  const lobbyID = req.params.id;
  gm.updateGameConfig(lobbyID, {
    gameMap: req.body.gameMap,
    difficulty: req.body.difficulty,
    disableBots: req.body.disableBots,
    disableNPCs: req.body.disableNPCs,
    creativeMode: req.body.creativeMode,
  });
});

app.get("/lobby/:id/exists", (req, res) => {
  const lobbyId = req.params.id;
  console.log(`checking lobby ${lobbyId} exists`);
  const lobbyExists = gm.hasActiveGame(lobbyId);

  res.json({
    exists: lobbyExists,
  });
});

app.get("/lobby/:id", (req, res) => {
  const game = gm.game(req.params.id);
  if (game == null) {
    console.log(`lobby ${req.params.id} not found`);
    return res.status(404).json({ error: "Game not found" });
  }
  res.json({
    players: game.activeClients.map((c) => ({
      username: c.username,
      clientID: c.clientID,
    })),
  });
});

app.get("/private_lobby/:id", (req, res) => {
  res.json({
    hi: "5",
  });
});

app.get("*", function (req, res) {
  // SPA routing
  res.sendFile(path.join(__dirname, "../../out/index.html"));
});

wss.on("connection", (ws, req) => {
  ws.on("message", (message: string) => {
    try {
      const clientMsg: ClientMessage = ClientMessageSchema.parse(
        JSON.parse(message),
      );
      if (clientMsg.type == "join") {
        const forwarded = req.headers["x-forwarded-for"];
        let ip = Array.isArray(forwarded)
          ? forwarded[0] // Get the first IP if it's an array
          : forwarded || req.socket.remoteAddress;
        if (Array.isArray(ip)) {
          ip = ip[0];
        }
        const { isValid, error } = validateUsername(clientMsg.username);
        if (!isValid) {
          console.log(
            `game ${clientMsg.gameID}, client ${clientMsg.clientID} received invalid username, ${error}`,
          );
          return;
        }
        clientMsg.username = sanitizeUsername(clientMsg.username);
        gm.addClient(
          new Client(
            clientMsg.clientID,
            clientMsg.persistentID,
            ip,
            clientMsg.username,
            ws,
          ),
          clientMsg.gameID,
          clientMsg.lastTurn,
        );
      }
      if (clientMsg.type == "log") {
        slog({
          logKey: "client_console_log",
          msg: clientMsg.log,
          severity: clientMsg.severity,
          clientID: clientMsg.clientID,
          gameID: clientMsg.gameID,
          persistentID: clientMsg.persistentID,
        });
      }
    } catch (error) {
      console.log(`errror handling websocket message: ${error}`);
    }
  });
  ws.on("error", (error: Error) => {
    if ((error as any).code === "WS_ERR_UNEXPECTED_RSV_1") {
      ws.close(1002);
    }
  });
});

function runGame() {
  setInterval(() => tick(), 1000);
  setInterval(() => updateLobbies(), 100);
}

function tick() {
  gm.tick();
}

function updateLobbies() {
  lobbiesString = JSON.stringify({
    lobbies: gm
      .gamesByPhase(GamePhase.Lobby)
      .filter((g) => g.isPublic)
      .map((g) => ({
        id: g.id,
        msUntilStart: g.startTime() - Date.now(),
        numClients: g.numClients(),
        gameConfig: g.gameConfig,
      }))
      .sort((a, b) => a.msUntilStart - b.msUntilStart),
  });
}

const PORT = process.env.PORT || 3000;
console.log(`Server will try to run on http://localhost:${PORT}`);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

runGame();
