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

var TIMES = [60, 120, 240];
var DIFFICULTIES = ["easy", "medium", "hard"];

var players = {};    // socket.id -> player state
var games = {};      // challenger socket.id -> game info
var challenges = {}; // challenger socket.id -> open challenge
var online = 0;

// high score persists in a local file; starts fresh if the file doesn't exist
var highScore = { score: 0, player: null };
try {
    highScore = JSON.parse(fs.readFileSync(HIGHSCORE_FILE, "utf8"));
} catch (e) { /* no high score yet */ }

function save_high_score() {
    fs.writeFile(HIGHSCORE_FILE, JSON.stringify(highScore), function() {});
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

function record_result(p1, p2) {
    [p1, p2].forEach(function(p) {
        var s = parseInt(p.score) || 0;
        if (s > (highScore.score || 0)) {
            highScore = { score: s, player: p.name };
        }
    });
    save_high_score();
    io.emit("highScore", highScore);
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
        socket.emit("highScore", highScore);
    });

    function add_player(name) {
        players[socket.id] = {
            id: socket.id,
            name: name,
            text: "",
            question: "",
            score: "0",
            opponent: "-1",
        };
        update_players();
        socket.emit("login", {
            playerId: socket.id,
            player: players[socket.id]
        });
    }

    socket.on("create challenge", function(info) {
        info = info || {};
        var cap = TIMES.indexOf(parseInt(info.time)) !== -1 ? parseInt(info.time) : 120;
        var difficulty = DIFFICULTIES.indexOf(info.difficulty) !== -1 ? info.difficulty : "medium";
        var name = String(info.name || "guest").slice(0, 20);

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

        players[socket.id].opponent = key;
        players[key].opponent = socket.id;

        var cap = challenge.cap;
        var difficulty = challenge.difficulty;
        var questions = generate_questions(cap * 3, difficulty);

        games[key] = {
            name1: name,
            name2: players[key].name,
            id2: socket.id,
            cap: cap,
            difficulty: difficulty,
            spectators: []
        };
        update_games();

        io.to(key).emit("match found", {
            player: players[socket.id],
            opponent: socket.id,
            questions: questions,
            cap: cap,
            difficulty: difficulty
        });

        io.to(socket.id).emit("match found", {
            player: players[key],
            opponent: key,
            questions: questions,
            cap: cap,
            difficulty: difficulty
        });

        var time = cap + 5;
        var x = setInterval(function() {
            if (time <= 0) {
                if (socket.id in players && key in players) {
                    record_result(players[socket.id], players[key]);
                }
                clearInterval(x);
            }
            io.to(key).emit("tick", { time: time });
            io.to(socket.id).emit("tick", { time: time });

            // update spectators as well
            if (key in games) {
                games[key].spectators.forEach(function(spectator) {
                    io.to(spectator).emit("tick", { time: time });
                });
            }

            time--;
        }, 1000);
    });

    socket.on("spectate", function(info) {
        var id = (info || {}).id;
        if (id in games) {
            games[id].spectators.push(socket.id);
            socket.emit("spectate started", { cap: games[id].cap });
            socket.emit("update positions", { players: players });
        }
    });

    function disconnect() {
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

    socket.on("game end", function() {
        disconnect();
    });

    socket.on("update keyboard", function(keyboard) {
        if (!(socket.id in players)) return;
        players[socket.id].text = keyboard["text"];
        players[socket.id].question = keyboard["question"];
        players[socket.id].score = keyboard["score"];

        socket.emit("update positions", { players: players });
        socket.broadcast.to(players[socket.id].opponent).emit("update positions", { players: players });

        if (socket.id in games) {
            games[socket.id].spectators.forEach(function(spectator) {
                socket.broadcast.to(spectator).emit("update positions", { players: players });
            });
        } else if (players[socket.id].opponent in games) {
            games[players[socket.id].opponent].spectators.forEach(function(spectator) {
                socket.broadcast.to(spectator).emit("update positions", { players: players });
            });
        }
    });
});
