require("./utils")();

var express = require("express");
var fs = require("fs");
var path = require("path");

var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;
var host = process.env.HOST || "0.0.0.0";

var HIGHSCORE_FILE = path.join(__dirname, "highscore.json");

var TIMES = [30, 60, 120];
var DIFFICULTIES = ["easy", "medium", "hard"];
var MAX_SCORE = 500; // any reported score above this is treated as cheating

var players = {};    // socket.id -> player state
var games = {};      // "player 1" socket.id -> game info
var challenges = {}; // challenger socket.id -> open challenge
var online = 0;

// per-setting high scores ("cap:difficulty" -> {score, player}), persisted to a local file
var highScores = {};
try {
    var loaded = JSON.parse(fs.readFileSync(HIGHSCORE_FILE, "utf8"));
    if (loaded && typeof loaded === "object") {
        // migrate a legacy single high score into the default bracket
        highScores = ("score" in loaded) ? { "120:medium": loaded } : loaded;
    }
} catch (e) { /* no high scores yet */ }

function save_high_score() {
    fs.writeFile(HIGHSCORE_FILE, JSON.stringify(highScores), function() {});
}

function update_players() {
    io.emit("new player", {
        numPlayers: Object.keys(players).length,
        numOnline: online
    });
}

function update_games() {
    io.emit("update games", { games: games });
}

function update_challenges() {
    io.emit("update challenges", { challenges: challenges });
}

function record_result(p1, p2, cap, difficulty) {
    var key = cap + ":" + difficulty;
    var changed = false;
    [p1, p2].forEach(function(p) {
        var s = parseInt(p.score) || 0;
        var current = highScores[key] || { score: 0, player: null };
        if (!p.cheated && s <= MAX_SCORE && s > current.score) {
            highScores[key] = { score: s, player: p.name };
            changed = true;
        }
    });
    if (changed) {
        save_high_score();
        io.emit("highScore", highScores);
    }
}

function start_match(id1, id2, cap, difficulty) {
    var p1 = players[id1], p2 = players[id2];
    if (!p1 || !p2) return;

    [p1, p2].forEach(function(p) {
        p.text = "";
        p.question = "";
        p.score = "0";
        p.cheated = false;
        p.wantsRematch = false;
        p.matchCap = cap;
        p.matchDifficulty = difficulty;
    });
    p1.opponent = id2;
    p2.opponent = id1;

    var questions = generate_questions(cap * 3, difficulty);

    games[id1] = {
        name1: p2.name,
        name2: p1.name,
        id2: id2,
        cap: cap,
        difficulty: difficulty,
        spectators: (games[id1] && games[id1].spectators) || []
    };
    update_games();

    io.to(id1).emit("match found", {
        player: p2, opponent: id2, questions: questions, cap: cap, difficulty: difficulty
    });
    io.to(id2).emit("match found", {
        player: p1, opponent: id1, questions: questions, cap: cap, difficulty: difficulty
    });

    var time = cap + 5;
    var x = setInterval(function() {
        io.to(id1).emit("tick", { time: time });
        io.to(id2).emit("tick", { time: time });

        if (id1 in games) {
            games[id1].spectators.forEach(function(spectator) {
                io.to(spectator).emit("tick", { time: time });
            });
        }

        if (time <= 0) {
            if (players[id1] && players[id2]) {
                record_result(players[id1], players[id2], cap, difficulty);
            }
            if (id1 in games) {
                delete games[id1];
                update_games();
            }
            clearInterval(x);
        }

        time--;
    }, 1000);
}

server.listen(port, host, function() {
    console.log("Server listening at %s:%d", host, port);
});

app.use(express.static(__dirname + "/public"));

io.on("connection", function(socket) {
    ++online;

    socket.on("enter", function() {
        update_players();
        update_games();
        update_challenges();
        socket.emit("highScore", highScores);
    });

    function add_player(name) {
        players[socket.id] = {
            id: socket.id,
            name: name,
            text: "",
            question: "",
            score: "0",
            opponent: "-1",
            cheated: false,
            wantsRematch: false
        };
        update_players();
        socket.emit("login", {
            playerId: socket.id,
            player: players[socket.id]
        });
    }

    // tell a former opponent that this player is gone (disables their rematch button)
    function leave_pairing() {
        var p = players[socket.id];
        if (!p) return;
        var opp = p.opponent;
        if (opp !== "-1" && players[opp] && players[opp].opponent === socket.id) {
            io.to(opp).emit("opponent left");
        }
    }

    function remove_spectator() {
        Object.keys(games).forEach(function(k) {
            var i = games[k].spectators.indexOf(socket.id);
            if (i !== -1) games[k].spectators.splice(i, 1);
        });
    }

    socket.on("create challenge", function(info) {
        info = info || {};
        var cap = TIMES.indexOf(parseInt(info.time)) !== -1 ? parseInt(info.time) : 120;
        var difficulty = DIFFICULTIES.indexOf(info.difficulty) !== -1 ? info.difficulty : "medium";
        var name = String(info.name || "guest").slice(0, 20);

        leave_pairing();
        add_player(name);
        challenges[socket.id] = { id: socket.id, name: name, cap: cap, difficulty: difficulty };
        socket.emit("challenge posted", { cap: cap, difficulty: difficulty });
        update_challenges();
    });

    socket.on("cancel challenge", function() {
        delete challenges[socket.id];
        delete players[socket.id];
        update_challenges();
        update_players();
    });

    socket.on("accept challenge", function(info) {
        info = info || {};
        var key = info.id;
        var challenge = challenges[key];

        if (!challenge || key === socket.id || !(key in players) || players[key].opponent !== "-1") {
            socket.emit("challenge unavailable");
            return;
        }

        var name = String(info.name || "guest").slice(0, 20);
        add_player(name);

        delete challenges[key];
        delete challenges[socket.id];
        update_challenges();

        start_match(key, socket.id, challenge.cap, challenge.difficulty);
    });

    socket.on("rematch", function() {
        var p = players[socket.id];
        if (!p) return;
        var opp = p.opponent;
        if (opp === "-1" || !players[opp] || players[opp].opponent !== socket.id) {
            socket.emit("opponent left");
            return;
        }
        p.wantsRematch = true;
        io.to(opp).emit("rematch requested");
        if (players[opp].wantsRematch) {
            start_match(socket.id, opp, p.matchCap || 120, p.matchDifficulty || "medium");
        }
    });

    socket.on("main menu", function() {
        leave_pairing();
        delete challenges[socket.id];
        if (socket.id in games) delete games[socket.id];
        delete players[socket.id];
        update_games();
        update_challenges();
        update_players();
    });

    socket.on("stop spectate", function() {
        remove_spectator();
    });

    socket.on("spectate", function(info) {
        var id = (info || {}).id;
        if (id in games) {
            games[id].spectators.push(socket.id);
            socket.emit("spectate started", { cap: games[id].cap, difficulty: games[id].difficulty });
            socket.emit("update positions", { players: players });
        }
    });

    function disconnect() {
        leave_pairing();
        remove_spectator();
        delete challenges[socket.id];
        if (socket.id in games)
            delete games[socket.id];
        if (players[socket.id])
            delete games[players[socket.id].opponent];
        update_games();
        update_challenges();

        delete players[socket.id];
        update_players();
    }

    socket.on("disconnect", function() {
        --online;
        disconnect();
    });

    socket.on("update keyboard", function(keyboard) {
        if (!(socket.id in players)) return;
        keyboard = keyboard || {};
        var p = players[socket.id];
        p.text = String(keyboard["text"] || "").slice(0, 20);
        p.question = String(keyboard["question"] || "").slice(0, 40);

        // anti-cheat: scores are capped; anything unrealistic is zeroed and flagged
        var score = parseInt(keyboard["score"]);
        if (isNaN(score) || score < 0 || score > MAX_SCORE) {
            p.cheated = true;
            score = 0;
        }
        p.score = String(score);

        socket.emit("update positions", { players: players });
        socket.broadcast.to(p.opponent).emit("update positions", { players: players });

        if (socket.id in games) {
            games[socket.id].spectators.forEach(function(spectator) {
                socket.broadcast.to(spectator).emit("update positions", { players: players });
            });
        } else if (p.opponent in games) {
            games[p.opponent].spectators.forEach(function(spectator) {
                socket.broadcast.to(spectator).emit("update positions", { players: players });
            });
        }
    });
});