const COLORS = {
    "r":"red",
    "g":"green",
    "b":"blue",
    "y":"yellow",
    "k":"black"
};

const ELECTRODE_STATUS = {
    "noisy":{
        "label":"Noisy (ungrounded)",
        "shortlabel":"Noisy",
        "color":"rgb(191, 191, 191)"
    },
    "quiet":{
        "label":"Quiet (grounded, no activity)",
        "shortlabel":"Quiet",
        "color":"rgb(255, 104, 83)"
    },
    "cells":{
        "label":"Cells",
        "shortlabel":"Cells",
        "color":"rgb(198, 255, 13)"
    },
    "whitematter":{
        "label":"White matter",
        "shortlabel":"WM",
        "color":"rgb(83, 152, 255)"
    }
};

const MM_PER_TURN = 25.4/90;
const MAX_TURNS = 90;
const TICK_SPACING = 3;

var electrode_params = {
    "electrode_pairs":[
        [-3.75,  5.35],
        [-1.25,  5.35],
        [ 1.25,  5.35],
        [ 3.75,  5.35],
        [-6.25,  2.35],
        [-3.75,  2.35],
        [-1.25,  2.35],
        [ 1.25,  2.35],
        [ 3.75,  2.35],
        [ 6.25,  2.35],
        [-6.25, -0.65],
        [-3.75, -0.65],
        [-1.25, -0.65],
        [ 1.25, -0.65],
        [ 3.75, -0.65],
        [ 6.25, -0.65],
        [-6.25, -3.65],
        [-3.75, -3.65],
        [-1.25, -3.65],
        [ 1.25, -3.65],
        [ 3.75, -3.65],
        [ 6.25, -3.65],
        [-3.75, -6.65],
        [-1.25, -6.65],
        [ 1.25, -6.65],
        [ 3.75, -6.65]
    ],
    "electrode_colors":[
        "r",
        "g",
        "b",
        "y",
        "k",
        "r",
        "g",
        "b",
        "y",
        "k",
        "r",
        "g",
        "b",
        "y",
        "k",
        "r",
        "g",
        "b",
        "y",
        "k",
        "r",
        "g",
        "b",
        "y",
        "k",
        "r"
    ],
    "electrode_numbers":[
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
        [11, 12],
        [13, 14],
        [15, 16],
        [17, 18],
        [19, 20],
        [21, 22],
        [23, 24],
        [25, 26],
        [27, 28],
        [29, 30],
        [31, 32],
        [33, 34],
        [35, 36],
        [37, 38],
        [39, 40],
        [41, 42],
        [43, 44],
        [45, 46],
        [47, 48],
        [49, 50],
        [51, 52]
    ]
};

var grid_params = {
    "grid_diameter":18.6,
    
    // Center offset and diameter of screw relative to electrode_pairs
    "screw_offset":[0, 0],
    "screw_diameter":1.5,

    // Center offset and diameter of electrodes relative to electrode_pairs
    "electrode_offsets":[[-0.5, 1.25], [0.5, 1.25]],
    "electrode_diameter":0.9
}

// Position of the current screw
var current_screw_position = 0;

// Stack of old screw_history for redo for each screw
var screw_redo_stack = [];
for (var i = 0; i < electrode_params.electrode_pairs.length; i++) {
    screw_redo_stack.push([]);
}

if ("screw_history" in localStorage) {
    var screw_history = JSON.parse(localStorage["screw_history"]);
} else {
    // History info for each screw
    var screw_history = [];
    for (var i = 0; i < electrode_params.electrode_pairs.length; i++) {
        screw_history[i] = [];
    }
}

function RedoStackEntry(indices, recs) {
    this.indices = indices;
    this.recs = recs;
}

/** MISCELLANEOUS **/

// Empty a DOM element of its children
function empty_element(node) {
    var child;
    while ((child = node.firstChild)) node.removeChild(child);
}

// Set or remove disabled attribute on an element
function set_disabled(el, val) {
    if (val) {
        el.setAttribute("disabled", "1");
    } else {
        el.removeAttribute("disabled");
    }
}

/** DRAWING IN RESPONSE TO EVENTS **/

// Insert text and background into a td element representing status
function draw_status_td(statustd, status) {
    statustd.textContent = ELECTRODE_STATUS[status].shortlabel;
    statustd.style.backgroundColor = tinycolor(ELECTRODE_STATUS[status].color).setAlpha(0.5);
}

// Draw color for a specific position (in turns)
function draw_turn_status(pos, status, explicit) {
    var turn = document.getElementById("turn-"+pos);
    
    // Don't overwrite explicit information
    if (turn.style.opacity == 1 && !explicit) return;

    turn.style.backgroundColor = ELECTRODE_STATUS[status].color;
    turn.style.opacity = explicit ? "1" : "0.5";
}

function draw_current_position() {
    document.getElementById("curpos").style.top = current_screw_position/MAX_TURNS*100+"%";
}

// Append a history row to the table in the document. Also update position info
function draw_action(at) {
    var pair_history = screw_history[get_current_pair()];
    var rec = pair_history[at];
    var tr = document.createElement("tr");
    var timetd = document.createElement("td");
    var actiontd = document.createElement("td");
    
    timetd.textContent = rec.time;
    if (rec.action == "advance") {
        actiontd.textContent = (rec.nturns < 0 ? "Retracted " : "Advanced ") + Math.abs(rec.nturns)+ " turn" + 
                               (Math.abs(rec.nturns) != 1 ? "s" : "");

        var last = Math.max(0, Math.round(current_screw_position+rec.nturns)-1);
        var oldstatus = get_electrode_status(at-1);
        if (rec.nturns < 0) {
            for (var i = Math.ceil(current_screw_position); i > last; i--) {
                draw_turn_status(i, oldstatus, false);
            }
        } else {
            for (var i = Math.ceil(current_screw_position); i < last; i++) {
                draw_turn_status(i, oldstatus, false);
            }
        }
        draw_turn_status(last, rec.status, true);

        current_screw_position += rec.nturns;
        draw_current_position();
    } else if (rec.action == "status") {
        actiontd.textContent = "Set status";
        draw_turn_status(current_screw_position, rec.status, true);
    }

    tr.appendChild(timetd);
    tr.appendChild(actiontd);
    tr.addEventListener("click", select_history, false);

    if (rec.status) {
        var statustd = document.createElement("td");
        draw_status_td(statustd, rec.status);
        tr.appendChild(statustd);
    } else {
        actiontd.colspan = 2;
    }

    tr.setAttribute("entry", at);

    document.getElementById("history-body").appendChild(tr);
}

// Redraw controls after selection of a new pair or undo
function redraw_pair_info() {
    // Reset position and clear turn status
    current_screw_position = 0;
    var turns = document.querySelectorAll(".turn");
    for (var i = 0; i < turns.length; i++) {
        turns[i].style.opacity = 0;
    }

    // Draw history
    empty_element(document.getElementById("history-body"));
    var cur_history = screw_history[get_current_pair()];
    for (var i = 0; i < cur_history.length; i++) {
        draw_action(i);
    }
    draw_current_position();

    // Set current status
    var curstatus = "noisy";
    for (var i = cur_history.length-1; i >= 0; i--) {
        if (cur_history[i].status) {
            curstatus = cur_history[i].status;
            break;
        }
    }
    var newstatus = get_electrode_status();
    for (var s in ELECTRODE_STATUS) {
        var a = document.getElementById("electrode-status-"+s);
        if (s == curstatus) {
            newstatus = s;
            a.setAttribute("selected", "1");
        } else {
            a.removeAttribute("selected");
        }
    }

    // Update buttons
    update_advance_buttons();
    update_history_buttons();
}

/** POSITIONING AND GRID **/

function validate_grid() {
    if (electrode_params.electrode_pairs.length != electrode_params.electrode_colors.length) {
        throw("Validation error: electrode pairs and colors must match")
    }
}

// Draw position axes and ticks
var turns = [];
function init_pos() {
    for (var i = 0; i <= MAX_TURNS-1; i++) {
        var turn = document.createElement("div");
        turn.className = "turn";
        turn.id = "turn-"+i;
        turn.style.top = i/MAX_TURNS*100+"%";
        turn.style.height = 100/MAX_TURNS+"%";
        turn.style.opacity = 0;
        document.getElementById("pos").appendChild(turn);
        turns.push(turn);
    }

    for (var i = 0; i <= MAX_TURNS; i += TICK_SPACING) {
        var tickpos = i/MAX_TURNS*100+"%";

        var lticklabel = document.createElement("div");
        lticklabel.className = "tick-label";
        lticklabel.style.top = tickpos;
        lticklabel.textContent = i;
        document.getElementById("pos-ltick-labels").appendChild(lticklabel);

        ["ltick", "rtick"].map(function (className) {
            var ltick = document.createElement("div");
            ltick.className = className;
            ltick.style.top = tickpos;
            document.getElementById("pos").appendChild(ltick);
        });

        var rticklabel = document.createElement("div");
        rticklabel.className = "tick-label";
        rticklabel.style.top = tickpos;
        rticklabel.textContent = Math.round(i*MM_PER_TURN*10)/10;
        document.getElementById("pos-rtick-labels").appendChild(rticklabel);
    }
}

// Draw grid and initialize history
function init_grid(electrode_params, skeleton) {
    var grid = document.getElementById("grid");
    empty_element(grid);

    for (var i = 0; i < electrode_params.electrode_pairs.length; i++) {
        if (!electrode_params.electrode_colors[i]) continue;
        var electrode_pair = electrode_params.electrode_pairs[i];
        if (!skeleton) {
            var color = COLORS[electrode_params.electrode_colors[i]];
            var text_color = tinycolor(color).getBrightness() < 127 ? "white" : "black";
        } else {
            var color = "white";
            var text_color = "black";
        }

        // Draw screws
        var screw = document.createElement("div");
        screw.className = "screw";
        screw.style.left = 50+((electrode_pair[0]-grid_params.screw_diameter/2+grid_params.screw_offset[0])/grid_params.grid_diameter)*100+"%";
        screw.style.bottom = 50+((electrode_pair[1]-grid_params.screw_diameter/2+grid_params.screw_offset[1])/grid_params.grid_diameter)*100+"%";
        screw.style.width = screw.style.height = grid_params.screw_diameter/grid_params.grid_diameter*100+"%";
        screw.style.backgroundColor = color;
        screw.setAttribute("pair", i);
        screw.addEventListener("click", set_selection, false);
        grid.appendChild(screw);

        var screw_text = document.createElement("div");
        screw_text.className = "screw-text";
        screw_text.style.color = text_color;

        for(var j = 0; j < grid_params.electrode_offsets.length; j++) {
            // Draw electrode
            var electrode = document.createElement("div");
            electrode.className = "electrode";
            electrode.style.left = 50+((electrode_pair[0]-grid_params.electrode_diameter/2+grid_params.electrode_offsets[j][0])/grid_params.grid_diameter)*100+"%";
            electrode.style.bottom = 50+((electrode_pair[1]-grid_params.electrode_diameter/2+grid_params.electrode_offsets[j][1])/grid_params.grid_diameter)*100+"%";
            electrode.style.width = electrode.style.height = grid_params.electrode_diameter/grid_params.grid_diameter*100+"%";
            electrode.style.backgroundColor = color;
            electrode.id = "electrode-"+i+"-"+j;
            electrode.setAttribute("pair", i);
            electrode.setAttribute("electrode", j);
            electrode.addEventListener("click", set_selection, false);

            // Draw text
            var electrode_text = document.createElement("div");
            electrode_text.className = "electrode-text";
            electrode_text.textContent = electrode_params.electrode_numbers[i][j];
            electrode_text.style.color = tinycolor(color).getBrightness() < 127 ? "white" : "black";

            electrode.appendChild(electrode_text);
            grid.appendChild(electrode);
        }
    }
}

// Get currently selected pair
function get_current_pair() {
    var screw = document.querySelector(".screw[selected]");
    if (!screw) return;
    var pair = screw.getAttribute("pair");
    return pair;
}

// Set selected electrode/channel. Called on click. this = screw or electrode
function set_selection() {
    var sel = this;
    var oldsel = document.querySelectorAll(".screw[selected], .electrode[selected]");
    for (var i = 0; i < oldsel.length; i++) {
        oldsel[i].removeAttribute("selected");
    }
    var newsel = document.querySelectorAll("[pair=\""+sel.getAttribute("pair")+"\"]");
    for (var i = 0; i < newsel.length; i++) {
        newsel[i].setAttribute("selected", "1");
    }

    redraw_pair_info();
}

/** CONTROLS **/

// Get control mode.
function get_control() {
    document.querySelector("#controls-menu > .pure-menu-selected").getAttribute("mode");
}

// Set control mode. Called on click. el = button
function set_control(el, event) {
    var butts = document.getElementById("controls-menu").children;
    for (var i = 0; i < butts.length; i++) {
        if (butts[i] == el) {
            document.getElementById("controls-"+butts[i].getAttribute("mode")).setAttribute("selected", "1");
            butts[i].classList.add("pure-menu-selected");
        } else {
            document.getElementById("controls-"+butts[i].getAttribute("mode")).removeAttribute("selected");
            butts[i].classList.remove("pure-menu-selected");
        }
    }

    if (el.getAttribute("mode") == "history") {
        select_last_history_entry();
        // Otherwise the global click handler would undo the selection
        event.stopPropagation();
    }
}

/** SCREW **/

// Add an action to the history and update UI
function do_action(rec) {
    var t = (new Date());
    var hr = t.getHours();
    var ampm = "AM";
    if (hr == 0) {
        rec.time = "12";
    } else if (hr < 12) {
        rec.time = hr.toString();
    } else {
        ampm = "PM";
        rec.time = hr == 12 ? "12" : (hr-12).toString();
    }
    rec.time += ":";
    var min = t.getMinutes();
    if (min < 10) rec.time += "0";
    rec.time += min+":";
    var sec = t.getSeconds();
    if (sec < 10) rec.time += "0";
    rec.time += sec+" "+ampm;

    var pair = get_current_pair();
    screw_redo_stack[pair] = [];
    screw_history[pair].push(rec);
    draw_action(screw_history[get_current_pair()].length-1);
    update_advance_buttons();
    update_history_buttons();
    localStorage["screw_history"] = JSON.stringify(screw_history);
}

// Update state of advance and retract buttons
function update_advance_buttons() {
    var pair = get_current_pair();

    var advance_buttons = document.querySelectorAll(".advance-button");
    for (var i = 0; i < advance_buttons.length; i++) {
        var nturns = advance_buttons[i].getElementsByClassName("electrode-nturns");
        amount = nturns.length ? parseFloat(nturns[0].value) : 1;
        set_disabled(advance_buttons[i], amount != amount || amount < 1 || current_screw_position + amount > MAX_TURNS || !pair);
    }

    var retract_buttons = document.querySelectorAll(".retract-button");
    for (var i = 0; i < retract_buttons.length; i++) {
        var nturns = retract_buttons[i].getElementsByClassName("electrode-nturns");
        amount = nturns.length ? parseFloat(nturns[0].value) : 1;
        set_disabled(retract_buttons[i], amount != amount || amount < 1 || current_screw_position - amount < 0 || !pair);
    }
}

// Advance electrode. Called on advance/retract button click
function advance(nturns) {
    nturns = parseFloat(nturns);
    if (!get_current_pair() ||
        nturns != nturns ||
        current_screw_position + nturns < 0 ||
        current_screw_position + nturns > MAX_TURNS) return;
    do_action({
        "action":"advance",
        "nturns":nturns,
        "status":get_electrode_status()
    });
}

// Draw electrode status menu
function init_electrode_status() {
    var first = true;
    for (var s in ELECTRODE_STATUS) {
        var rec = ELECTRODE_STATUS[s];
        var li = document.createElement("li");
        var a = document.createElement("a");

        a.id = "electrode-status-"+s;
        a.className = "electrode-status";
        a.setAttribute("value", s);
        a.style.backgroundColor = rec.color;
        a.addEventListener("click", set_electrode_status, false);

        li.appendChild(a);
        a.appendChild(document.createTextNode(rec.label));

        document.getElementById("electrode-status-ul").appendChild(li);
    }
}

// Get status of current electrode pair
function get_electrode_status(at) {
    var hist = screw_history[get_current_pair()];
    for (var i = at ? at : hist.length-1; i >= 0; i--) {
        if (hist[i].status) return hist[i].status;
    }
    return "noisy";
}

// Set electrode status. Called on click. this = button
function set_electrode_status() {
    var pair = get_current_pair();
    if (!pair) return;

    var newstatus;
    for (var s in ELECTRODE_STATUS) {
        var a = document.getElementById("electrode-status-"+s);
        if (this == a) {
            newstatus = s;
            a.setAttribute("selected", "1");
        } else {
            a.removeAttribute("selected");
        }
    }

    var pair_history = screw_history[pair];
    if (pair_history.length == 0 || !pair_history[screw_history[pair].length-1].status) {
        do_action({
            "action":"status",
            "status":newstatus
        });
    } else {
        pair_history[screw_history[pair].length-1].status = newstatus;
        draw_status_td(document.getElementById("history-body").lastChild.lastChild, newstatus);
        draw_turn_status(current_screw_position, newstatus, true);
        localStorage["screw_history"] = JSON.stringify(screw_history);
    }
}

/** HISTORY **/

function select_last_history_entry() {
    // Set selection to last row
    var rows = document.getElementById("history-table").rows;
    if (rows.length > 1) {
        rows[rows.length-1].setAttribute("selected", "1");
    }
}

function toggle_selection(el) {
    if (el.hasAttribute("selected")) {
        el.removeAttribute("selected");
    } else {
        el.setAttribute("selected", "1");
    }
}

// Select history item. this = item
function select_history(event) {
    if (event.ctrlKey || event.metaKey) {
        toggle_selection(this);
    } else {
        var selected = document.querySelectorAll("#history-table tr[selected]");
        if (event.shiftKey && selected.length) {
            var rows = document.getElementById("history-table").rows;
            for (var i = this.rowIndex; i < selected[selected.length-1].rowIndex; i++) {
                rows[i].setAttribute("selected", "1")
            }
            for (var i = selected[0].rowIndex+1; i <= this.rowIndex; i++) {
                rows[i].setAttribute("selected", "1")
            }
        } else {
            for (var i = 0; i < selected.length; i++) {
                if (selected[i] == this) continue;
                selected[i].removeAttribute("selected");
            }
            toggle_selection(this);
        }
    }
    event.stopPropagation();
}

// Global click handler to clear history selection
document.addEventListener("click", function () {
    var selected = document.querySelectorAll("#history-table tr[selected]");
    for (var i = 0; i < selected.length; i++) {
        selected[i].removeAttribute("selected");
    }
}, false);

// Undo selected history
function undo(event) {
    var selected = document.querySelectorAll("#history-table tr[selected]");
    if (!selected.length) return;
    var remove = [];

    for (var i = 0; i < selected.length; i++) {
        remove.unshift(selected[i].getAttribute("entry"));
    }

    var pair = get_current_pair();
    var recs = [];
    for (var i = 0; i < remove.length; i++) {
        recs[i] = screw_history[pair][remove[i]];
        screw_history[pair].splice(remove[i], 1);
    }

    screw_redo_stack[pair].push(new RedoStackEntry(remove.reverse(), recs));

    redraw_pair_info();
    select_last_history_entry();
    update_history_buttons();
}

function redo(event) {
    var pair = get_current_pair();
    if (!screw_redo_stack[pair].length) return;

    // Splice back in
    var entry = screw_redo_stack[pair].pop();
    for (var i = 0; i < entry.indices.length; i++) {
        var index = entry.indices[i];
        screw_history[pair].splice(index, 0, entry.recs[i]);
    }

    redraw_pair_info();

    // Select what was redone
    for (var i = 0; i < entry.indices.length; i++) {
        document.querySelector("#history-table tr[entry='"+entry.indices[i]+"']").setAttribute("selected", "1");
    }
    update_history_buttons();
}

function update_history_buttons() {
    var can_undo = false, can_redo = false, pair;
    if ((pair = get_current_pair())) {
        can_undo = screw_history[pair].length != 0;
        can_redo = screw_redo_stack[pair].length != 0;
    }
    set_disabled(document.getElementById("undo-button"), !can_undo);
    set_disabled(document.getElementById("redo-button"), !can_redo);
}

/** SETUP **/

// Set rotation. Called when slider is moved or rotation is changed
function rotation_change(newrot) {
    document.getElementById("rotation").value = newrot;
    document.getElementById("rotation-slider").value = newrot;

    var grid = document.getElementById("grid");
    grid.style.transform = grid.style.webkitTransform = "rotate("+newrot+"deg)";

    var electrodes = document.getElementsByClassName("electrode-text");
    for (var i = 0; i < electrodes.length; i++) {
        electrodes[i].style.transform = electrodes[i].style.webkitTransform = 
            "translateX(-50%) translateY(-50%) rotate("+(-newrot)+"deg)";
    }

    grid_params.rotation = newrot;
}

function clear_history() {
    delete localStorage["screw_history"];
    for (var i = 0; i < electrode_params.electrode_pairs.length; i++) {
        screw_history[i] = [];
        screw_redo_stack[i] = [];
    }
    redraw_pair_info();
}

function load_history() {
    document.getElementById("hidden-load-input").click();
}

function load_history_file(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
        var data = JSON.parse(event.target.result);
        electrode_params = data.electrode_params;
        localStorage["electrode_params"] = JSON.stringify(electrode_params);
        grid_params = data.grid_params;
        localStorage["grid_params"] = JSON.stringify(grid_params);
        screw_history = data.screw_history;
        localStorage["screw_history"] = JSON.stringify(screw_history);
    };
    reader.readAsText(file);
}

function save_history() {
    var params = {
        "electrode_params":electrode_params,
        "grid_params":grid_params,
        "screw_history":screw_history
    };
    var blob = new Blob([JSON.stringify(params, false, "\t")], {type:"application/json;charset=utf-8"});
    saveAs(blob, "tracker.json");
}

init_pos();
init_grid(electrode_params);
init_electrode_status();
