const socket = io();
socket.emit("enter");

// player state
var keyboard = { text: "", question: "", score: "0" };

// game information
var players = {};
var numPlayers = 0;
var playerId;
var playerName;
var questions = [];
var question_id = 0;
var games = {};
var challenges = {};
var cap = 120;
var matchDifficulty = "medium"; // difficulty of the current match / spectated game
var highScores = {};            // "cap:difficulty" -> {score, player}
var opponentId = -1;
var lastName = "guest";

// pre-match settings (challenger's settings are used for the match)
var settings = { time: 120, difficulty: "medium" };

var TIME_OPTS = [30, 60, 120];
var DIFF_META = {
    easy: {
        color: "green",
        info: "Addition: (2–60) · Subtraction: (2–60) · Multiplication: (2–12)×(2–20) · Division: reverse multiplication"
    },
    medium: {
        color: "yellow",
        info: "Addition: (2–100) · Subtraction: (2–100) · Multiplication: (2–12)×(2–100) · Division: reverse multiplication (Zetamac default)"
    },
    hard: {
        color: "red",
        info: "Addition: (2–300) · Subtraction: (2–300) · Multiplication: (2–20)×(2–200) · Division: reverse multiplication"
    }
};

// spectating info
var spectating = 0;
var spec_id1 = -1;
var spec_id2 = -1;

// DOM elements
var question1 = document.getElementById("question1");
var question2 = document.getElementById("question2");

var textbox1 = document.getElementById("text1");
var textbox2 = document.getElementById("text2");

var score1 = document.getElementById("score1");
var score2 = document.getElementById("score2");

var name1 = document.getElementById("name1");
var name2 = document.getElementById("name2");

var banner = document.getElementById("banner");
var game = document.getElementById("game");
var startEl = document.getElementById("start");
var newGame = document.getElementById("new-game");
var cancelBtn = document.getElementById("cancel-challenge");
var rematchBtn = document.getElementById("rematch");
var mainMenuBtn = document.getElementById("main-menu");
var leaveBtn = document.getElementById("leave-spectate");
var playerInput = document.getElementById("player");
var diffInfo = document.getElementById("diff-info");

var online_counter = document.getElementById("online");
var list_games = document.getElementById("games");
var list_challenges = document.getElementById("challenges");
var highScore = document.getElementById("high-score");

var graphWrap = document.getElementById("graph-wrap");
var graphBtn = document.getElementById("toggle-graph");
var graphHidden = false;

var sidebar = document.getElementById("sidebar");
var backdrop = document.getElementById("backdrop");
var keypad = document.getElementById("keypad");

//// mobile menu

function toggle_menu() {
    var open = !sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", open);
    backdrop.classList.toggle("hidden", !open);
}

function close_menu() {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.add("hidden");
}

//// mobile keypad (only visible on small screens via CSS)

function show_keypad() {
    keypad.classList.remove("hidden");
}

function hide_keypad() {
    keypad.classList.add("hidden");
}

function keypad_press(key) {
    if (textbox1.readOnly) return;
    if (key === "back") {
        textbox1.value = textbox1.value.slice(0, -1);
    } else {
        textbox1.value += key;
    }
    inputEvent({});
}

// fire on touchstart (finger down) instead of click (finger up + browser delay),
// so rapid taps register instantly; preventDefault stops the duplicate synthetic click
keypad.querySelectorAll("button").forEach(function(btn) {
    var press = function(e) {
        e.preventDefault();
        keypad_press(btn.getAttribute("data-key"));
        btn.style.filter = "brightness(1.4)";
        setTimeout(function() { btn.style.filter = ""; }, 80);
    };
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("mousedown", press); // fallback for narrow desktop windows
});

//// settings UI

function select_time(t) {
    settings.time = t;
    TIME_OPTS.forEach(function(o) {
        var el = document.getElementById("time-" + o);
        var sel = o === t;
        el.classList.toggle("bg-blue-500", sel);
        el.classList.toggle("text-white", sel);
        el.classList.toggle("border-blue-500", sel);
        el.classList.toggle("bg-white", !sel);
        el.classList.toggle("text-blue-600", !sel);
        el.classList.toggle("border-blue-300", !sel);
    });
    update_high_score_display();
}

function select_diff(d) {
    settings.difficulty = d;
    Object.keys(DIFF_META).forEach(function(o) {
        var el = document.getElementById("diff-" + o);
        var c = DIFF_META[o].color;
        var sel = o === d;
        el.classList.toggle("bg-" + c + "-100", sel);
        el.classList.toggle("ring-2", sel);
        el.classList.toggle("ring-" + c + "-400", sel);
        el.classList.toggle("bg-white", !sel);
    });
    var c = DIFF_META[d].color;
    diffInfo.className = "mt-2 text-sm text-center rounded-lg p-3 bg-" + c + "-50 text-" + c + "-700";
    diffInfo.textContent = DIFF_META[d].info;
    update_high_score_display();
}

function diff_label(d) {
    return d.charAt(0).toUpperCase() + d.slice(1);
}

// show the high score for whatever time/difficulty is relevant right now:
// menu = the settings being picked; in game / waiting / spectating = that game's settings
function update_high_score_display() {
    var inMenu = !startEl.classList.contains("hidden");
    var t = inMenu ? settings.time : cap;
    var d = inMenu ? settings.difficulty : matchDifficulty;
    var hs = highScores[t + ":" + d];
    var label = t + "s " + diff_label(d);
    if (hs && hs.player) {
        highScore.textContent = "High Score (" + label + "): " + hs.score + " by " + hs.player;
    } else {
        highScore.textContent = "High Score (" + label + "): —";
    }
}

//// graph toggle

function set_graph_hidden(h) {
    graphHidden = h;
    graphWrap.style.display = h ? "none" : "block";
    graphBtn.textContent = h ? "Show graph" : "Hide graph";
}

function toggle_graph() {
    set_graph_hidden(!graphHidden);
}

//// screens

function show_game() {
    startEl.classList.add("hidden");
    game.style.display = "block";
}

function show_start() {
    game.style.display = "none";
    startEl.classList.remove("hidden");
    hide_keypad();
    update_high_score_display(); // back to menu: show the selected bracket again
}

function hide_end_buttons() {
    newGame.style.display = "none";
    mainMenuBtn.style.display = "none";
    rematchBtn.style.display = "none";
    rematchBtn.disabled = false;
    rematchBtn.textContent = "Rematch";
}

function reset_board() {
    hide_end_buttons();
    textbox1.value = "";
    textbox2.value = "";
    name2.textContent = "Waiting...";
    question1.textContent = "? + ?";
    question2.textContent = "? + ?";
    score1.textContent = "0";
    score2.textContent = "0";
    players = {};
    question_id = 0;
    keyboard = { text: "", question: "", score: "0" };
    updatedLabels = false;
    reset_chart(cap);
}

//// chart

var data = {
    labels: [],
    datasets: [
        {
            label: "Player 1",
            fill: false,
            lineTension: 0.1,
            backgroundColor: "rgba(75,192,192,0.4)",
            borderColor: "rgba(75,192,192,1)",
            data: [],
        },
        {
            label: "Player 2",
            fill: false,
            lineTension: 0.1,
            backgroundColor: "rgba(192,75,192,0.4)",
            borderColor: "rgba(192,75,192,1)",
            data: [],
        }
    ]
};

let config = {
    type: 'line',
    data: data,
    options: {
        showLines: true,
        responsive: true,
        animation: false
    }
};

let myChart = new Chart(
    document.getElementById('graph'),
    config
);

function reset_chart(newCap) {
    var labels = [];
    for (let i = 0; i <= newCap; i++) labels.push(i);
    myChart.data.labels = labels;
    myChart.data.datasets[0].data = Array(newCap + 1).fill(null);
    myChart.data.datasets[1].data = Array(newCap + 1).fill(null);
    myChart.data.datasets[0].label = "Player 1";
    myChart.data.datasets[1].label = "Player 2";
    myChart.update();
}

reset_chart(cap);

//// playing

addEventListener("keydown", function(event) {
    if (event.keyCode === 13) {
        if (!startEl.classList.contains("hidden")) play();
        else if (newGame.style.display === "block") startGame();
    }
});

function play() {
    var name = playerInput.value.trim() || "Guest";
    playerName = name;
    lastName = name;
    spectating = -1;
    socket.emit("create challenge", {
        name: name,
        time: settings.time,
        difficulty: settings.difficulty
    });
}

var startGame = function() {
    socket.emit("create challenge", {
        name: lastName,
        time: settings.time,
        difficulty: settings.difficulty
    });
};

function cancel_challenge() {
    socket.emit("cancel challenge");
    cancelBtn.style.display = "none";
    show_start();
}

function main_menu() {
    socket.emit("main menu");
    hide_end_buttons();
    opponentId = -1;
    show_start();
}

function request_rematch() {
    socket.emit("rematch");
    rematchBtn.disabled = true;
    rematchBtn.textContent = "Rematch requested...";
}

function leave_spectate() {
    socket.emit("stop spectate");
    spectating = 0;
    spec_id1 = -1;
    spec_id2 = -1;
    leaveBtn.style.display = "none";
    textbox1.readOnly = true;
    show_start();
}

function accept_challenge(id) {
    if (spectating === 1) return;
    if (startEl.classList.contains("hidden")) return; // already waiting or playing
    var name = playerInput.value.trim() || "Guest";
    playerName = name;
    lastName = name;
    spectating = -1;
    close_menu();
    socket.emit("accept challenge", { id: id, name: name });
}

function new_question() {
    var question = questions[question_id++];
    question1.textContent = question;
    keyboard["question"] = question;
    socket.emit("update keyboard", keyboard);
}

function check() {
    var q = question1.textContent;
    if (!!q) {
        var ans = eval(q);
        if (ans === parseInt(textbox1.value)) {
            textbox1.value = "";
            score1.textContent = parseInt(score1.textContent) + 1 + "";
            keyboard["text"] = textbox1.value;
            keyboard["score"] = score1.textContent;
            socket.emit("update keyboard", keyboard);
            new_question();
        }
    }
}

function inputEvent(e) {
    if (playerName) {
        check();
        keyboard["text"] = textbox1.value;
        socket.emit("update keyboard", keyboard);
    }
}

addEventListener("input", inputEvent, false);

function init_names() {
    Object.keys(players).forEach(function(key) {
        if (key === playerId) {
            name1.textContent = players[key].name;
        } else {
            name2.textContent = players[key].name;
        }
    });
}

//// socket events

socket.on("login", function(data) {
    playerId = data.playerId;
    players[playerId] = data.player;
    init_names();
});

socket.on("highScore", function(data) {
    highScores = data || {};
    update_high_score_display();
});

socket.on("challenge posted", function(data) {
    cap = data.cap;
    matchDifficulty = data.difficulty;
    reset_board();
    show_game();
    banner.textContent = "Waiting for someone to accept your challenge...";
    cancelBtn.style.display = "block";
    update_high_score_display();
});

socket.on("challenge unavailable", function() {
    alert("That challenge is no longer available.");
});

socket.on("match found", function(data) {
    cap = data.cap;
    matchDifficulty = data.difficulty;
    reset_board();
    show_game();
    cancelBtn.style.display = "none";
    players[data.player.id] = data.player;
    opponentId = data.opponent;
    questions = data.questions;
    score1.textContent = "0";
    init_names();
});

function createElementFromHTML(htmlString) {
    var div = document.createElement("div");
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

function spectate(id, id2) {
    if (spectating === 0) {
        socket.emit("spectate", { id: id });
        spec_id1 = id;
        spec_id2 = id2;
        spectating = 1;
    }
}

socket.on("spectate started", function(data) {
    cap = data.cap;
    matchDifficulty = data.difficulty;
    update_high_score_display();
    reset_chart(cap);
    startEl.classList.add("hidden");
    game.style.display = "block";
    textbox2.type = "text";
    leaveBtn.style.display = "block";
    close_menu();
});

socket.on("rematch requested", function() {
    if (!rematchBtn.disabled) {
        rematchBtn.textContent = "Rematch? (opponent is ready)";
    }
});

socket.on("opponent left", function() {
    rematchBtn.disabled = true;
    rematchBtn.textContent = "Opponent left";
});

socket.on("update games", function(data) {
    games = data.games;
    list_games.innerHTML = "";
    Object.keys(games).forEach(function(id) {
        var info = games[id];
        var element = document.createElement("div");
        element.className = "bg-blue-200 shadow-md rounded-xl p-2 text-center cursor-pointer hover:bg-blue-300";
        element.textContent = info.name1 + " vs " + info.name2 + " · " + info.cap + "s · " + diff_label(info.difficulty);
        element.onclick = function() { spectate(id, info.id2); };
        list_games.appendChild(element);
    });
});

socket.on("update challenges", function(data) {
    challenges = data.challenges;
    list_challenges.innerHTML = "";
    var ids = Object.keys(challenges);
    if (ids.length === 0) {
        var empty = document.createElement("div");
        empty.className = "text-center text-sm text-gray-500";
        empty.textContent = "No open challenges";
        list_challenges.appendChild(empty);
        return;
    }
    ids.forEach(function(id) {
        var c = challenges[id];
        var mine = id === socket.id;
        var element = document.createElement("div");
        if (mine) {
            element.className = "bg-yellow-100 shadow-md rounded-xl p-2 text-center";
            element.textContent = "Your challenge · " + c.cap + "s · " + diff_label(c.difficulty);
        } else {
            element.className = "bg-green-200 shadow-md rounded-xl p-2 text-center cursor-pointer hover:bg-green-300";
            element.textContent = c.name + " · " + c.cap + "s · " + diff_label(c.difficulty);
            element.onclick = function() { accept_challenge(id); };
        }
        list_challenges.appendChild(element);
    });
});

function update_online(count) {
    numPlayers = count.numPlayers;
    online = count.numOnline;
    online_counter.textContent = "Online: " + online + ", in game: " + numPlayers;
}

socket.on("new player", function(data) {
    update_online(data);
});

let time = 0;

socket.on("tick", function(data) {
    time = data.time;
    if (time < cap && time >= 0) {
        for (let i = 0; i < 2; i++) {
            myChart.data.datasets[i].data[cap - time] = myChart.data.datasets[i].data[cap - time - 1];
        }
        myChart.update();
    }
    if (time >= cap + 2) {
        banner.textContent = time - cap - 1 + "..";
    } else if (time === cap + 1) {
        banner.textContent = "GO!";
    } else if (time === cap) {
        banner.textContent = time + "";
        if (spectating !== 1) {
            textbox1.readOnly = false;
            show_keypad();
            new_question();
        }
    } else if (time <= 0) {
        var final_score1 = parseInt(score1.textContent);
        var final_score2 = parseInt(score2.textContent);
        if (final_score1 < final_score2) {
            banner.textContent = name2.textContent + " won!";
        } else if (final_score1 > final_score2) {
            banner.textContent = name1.textContent + " won!";
        } else {
            banner.textContent = "Tied game!";
        }

        textbox1.readOnly = true;
        hide_keypad();
        set_graph_hidden(false); // graph pops up when the game finishes
        if (spectating !== 1) {
            rematchBtn.style.display = "block";
            newGame.style.display = "block";
            mainMenuBtn.style.display = "block";
        }
    } else {
        banner.textContent = time + "";
    }
});

socket.on("update positions", function(data) {
    players = data.players;

    Object.keys(players).forEach(function(key) {
        if (spectating === 1) {
            if (key === spec_id1) {
                name1.textContent = players[spec_id1].name;
                textbox1.value = players[key].text;
                question1.textContent = players[key].question;
                score1.textContent = players[key].score;
                addPoint(0, players[key].score);
            } else if (key === spec_id2) {
                name2.textContent = players[spec_id2].name;
                textbox2.value = players[key].text;
                question2.textContent = players[key].question;
                score2.textContent = players[key].score;
                addPoint(1, players[key].score);
            }
        } else {
            if (key === opponentId) {
                textbox2.value = "*".repeat((players[key].text).length);
                question2.textContent = players[key].question;
                score2.textContent = players[key].score;
                addPoint(1, players[key].score);
            } else if (key === playerId) {
                addPoint(0, players[key].score);
            }
        }
    });
});

let updatedLabels = false;

function addPoint(pid, point) {
    if (!updatedLabels) {
        myChart.data.datasets[0].label = name1.textContent;
        myChart.data.datasets[1].label = name2.textContent;
        updatedLabels = true;
    }
    myChart.data.datasets[pid].data[cap - time] = point;
    myChart.update();
}

//// init

select_time(120);
select_diff("medium");