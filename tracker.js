/** ERROR HANDLING **/

var dialog_callback;
function display_dialog(name, buttons_name, callback) {
    var container = document.getElementById("dialog-container");
    var contents = document.getElementById("dialog-content").children;
    for (var i = 0; i < contents.length; i++) {
        contents[i].style.display = contents[i].id == "dialog-"+name ? "block" : "none";
    }
    var buttons = document.getElementById("dialog-buttons").children;
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].style.display = buttons[i].id == "dialog-buttons-"+buttons_name ? "block" : "none";
    }
    container.style.display = "block";
    dialog_callback = callback;
}

function dialog_action(status) {
    document.getElementById("dialog-container").style.display = "none";
    var callback = dialog_callback;
    dialog_callback = null;
    callback(status);
}

window.onerror = function(message, file, line, col, error) {
    var txt = "\""+message+"\" in "+file+"@"+line+":"+col;
    if (error) {
        txt += "\n\nBacktrace:\n"+error.stack;
    }
    document.getElementById("dialog-error-text").textContent = txt;
    display_dialog("error", "error", function(action) {
        if (action == "save") {
            save();
        } else if (action == "refresh") {
            location.reload();
        }
    });
};

/** CONSTANTS **/

const COLORS = ["red", "green", "blue", "yellow", "black", "white"];

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

function grid_template() {
    var g1 = {
        "grid":{
            "grid_diameter":19,
            
            // Center offset and diameter of screw relative to electrode pairs
            "screw_offset":[0, -1.4986],
            "screw_diameter":1.8,

            // Center offset and diameter of electrodes relative to electrode pairs
            "electrode_offsets":[[-.508, 0], [.508, 0]],
            "electrode_diameter":0.9,

            "rotation":0
        },
        "electrodes":{
            "pairs":[
                // [-6.223,    6.7437],
                [-3.7338,   6.7437],
                [-1.2446,   6.7437],
                [ 1.2446,   6.7437],
                [ 3.7338,   6.7437],
                // [ 6.223,    6.7437],
                [-6.223,    3.7465],
                [-3.7338,   3.7465],
                [-1.2446,   3.7465],
                [ 1.2446,   3.7465],
                [ 3.7084,   3.7465],
                [ 6.223,    3.7465],
                [-6.223,    0.7493],
                [-3.7338,   0.7493],
                [-1.2446,   0.7493],
                [ 1.2446,   0.7493],
                [ 3.7338,   0.7493],
                [ 6.223,    0.7493],
                [-6.223,   -2.2479],
                [-3.7338,  -2.2479],
                [-1.2446,  -2.2479],
                [ 1.2446,  -2.2479],
                [ 3.7338,  -2.2479],
                [ 6.223,   -2.2479],
                // [-6.223,   -5.2451],
                [-3.7338,  -5.2451],
                [-1.2446,  -5.2451],
                [ 1.2446,  -5.2451],
                [ 3.7338,  -5.2451],
                // [ 6.223,   -5.2451],
                // [-1.2446,  -8.2423],
                // [ 1.2446,  -8.2423]
            ],
            "colors":[],
            "numbers":[]
        },
        "histories":{},
        "offsets":{}
    };
    return g1;
}

if ("grids" in localStorage) {
    var grids = JSON.parse(localStorage["grids"]);
} else {
    var grids = {"Untitled Grid":grid_template()};
}

function new_history(pairs) {
    var history = [];
    for (var i = 0; i < pairs.length; i++) {
        history[i] = [];
    }
    return history;
}

if ("histories" in localStorage) {
    var histories = JSON.parse(localStorage["histories"]);
} else {
    var histories = {};
}
for (var gridname in grids) {
    if (!histories.hasOwnProperty(gridname)) {
        histories[gridname] = new_history(grids[gridname].electrodes.pairs);
    }
}

// Stack of old screw_history for redo for each screw
var redo_stacks = {};

function new_redo_stack(name) {
    var grid_screw_redo_stack = [];
    for (var i = 0; i < grids[name].electrodes.pairs.length; i++) {
        grid_screw_redo_stack.push([]);
    }
    redo_stacks[name] = grid_screw_redo_stack;
}

function init_redo_stacks() {
    for (var grid in grids) {
        new_redo_stack(grid);
    }
}

function RedoStackEntry(indices, recs) {
    this.indices = indices;
    this.recs = recs;
}

// Notes not yet saved
var unsaved_notes = [];

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

// Initialize list of grids
function init_grids(select_last) {
    var selector = document.getElementById("grid-selector");
    empty_element(selector);
    var ngrids = 0;
    for (var grid in grids) {
        var opt = document.createElement("option");
        opt.value = grid;
        opt.textContent = grid;
        selector.appendChild(opt);
        ngrids++;
    }
    if (selector.firstChild) {
        if (select_last) {
            selector.lastChild.selected = true;
        } else {
            selector.firstChild.selected = true;
        }
    }
    set_disabled(document.getElementById("delete-grid"), ngrids <= 1);
    select_grid();
}

// Pad a string with another string on the left to a given length
function lpad(str, len, withstr) {
    var newstr = str.toString();
    if (!withstr) withstr = "0";
    while (newstr.length < len) {
        newstr = withstr + newstr;
    }
    return newstr;
}

// Disambiguate a name by adding an increasing number to stem
// (if necessary) until it is no longer ambiguous with keys of v
function disambiguate(stem, v) {
    var name = stem;
    for(var i = 1; v.hasOwnProperty(name); i++) {
        name = stem + " " + i;
    }
    return name;
}

// Get a short date string
function date_string() {
    var d = new Date();
    return lpad(d.getFullYear(), 4)+"-"+lpad(d.getMonth()+1, 2)+"-"+lpad(d.getDate(), 2);
}

// Get a short time string
function time_string() {
    var t = (new Date());
    var hr = t.getHours();
    var ampm = "AM";
    var timestr;
    if (hr == 0) {
        timestr = "12";
    } else if (hr < 12) {
        timestr = hr.toString();
    } else {
        ampm = "PM";
        timestr = hr == 12 ? "12" : (hr-12).toString();
    }
    timestr += ":"+lpad(t.getMinutes(), 2)+":"+lpad(t.getSeconds(), 2)+" "+ampm;
    return timestr;
}

/** DRAWING IN RESPONSE TO EVENTS **/

// Draw screw text based on current position and status
function draw_screw_text(pair) {
    var position_text = document.querySelector(".screw[pair='"+pair+"'] > .screw-text > .screw-position-text");
    var status_text = document.querySelector(".screw[pair='"+pair+"'] > .screw-text > .screw-status-text");
    var pair_history = get_current_history()[pair];
    if (!pair_history) position_text.textContent = status_text.textContent = "";

    // Compute current position and last status
    var position = 0, status = "noisy";
    for (var i = 0; i < pair_history.length; i++) {
        if (pair_history[i].nturns) position += pair_history[i].nturns;
        if (pair_history[i].status) status = pair_history[i].status;
    }
    position_text.textContent = position+" \u27f3\n"+Math.round(MM_PER_TURN*position*10)/10+" mm";
    status_text.textContent = ELECTRODE_STATUS[status].shortlabel;
}

// Update screw text for all pairs
function draw_screw_text_all() {
    var grid = get_current_grid();
    for (var i = 0; i < grid.electrodes.pairs.length; i++) {
        draw_screw_text(i);
    }
}

// Insert text and background into a td element representing status
function draw_status_td(statustd, status) {
    statustd.textContent = ELECTRODE_STATUS[status].shortlabel;
    statustd.style.backgroundColor = tinycolor(ELECTRODE_STATUS[status].color).setAlpha(0.5);
}

// Append a history row to the table in the document. Also update position info
function draw_action(at) {
    var pair = get_current_pair();
    var pair_history = get_current_history()[pair];
    var rec = pair_history[at];
    var tr = document.createElement("tr");
    var timetd = document.createElement("td");
    var actiontd = document.createElement("td");
    
    timetd.textContent = rec.time;
    if (rec.action == "advance") {
        actiontd.textContent = (rec.nturns < 0 ? "Retracted " : "Advanced ") + Math.abs(rec.nturns)+ " turn" + 
                               (Math.abs(rec.nturns) != 1 ? "s" : "");
        draw_current_position();
    } else if (rec.action == "status") {
        actiontd.textContent = "Set status";
    } else if (rec.action == "note") {
        actiontd.textContent = "Note: "+rec.note;
    }

    position.draw_action(at, pair_history);

    tr.appendChild(timetd);
    tr.appendChild(actiontd);
    tr.addEventListener("click", select_history, false);

    if (rec.status) {
        var statustd = document.createElement("td");
        draw_status_td(statustd, rec.status);
        tr.appendChild(statustd);
    } else {
        actiontd.colSpan = 2;
    }

    tr.setAttribute("entry", at);

    document.getElementById("history-body").appendChild(tr);
}

// Redraw controls after selection of a new pair or undo
function redraw_pair_info() {
    // Reset position and clear turn status
    position.curpos = 0;
    var turns = document.querySelectorAll("#pos .turn");
    for (var i = 0; i < turns.length; i++) {
        turns[i].setAttribute("state", "hidden");
    }

    // Draw history
    empty_element(document.getElementById("history-body"));
    var pair = get_current_pair();
    if (pair) {
        var cur_history = get_current_history()[get_current_pair()];
        for (var i = 0; i < cur_history.length; i++) {
            draw_action(i, cur_history);
        }
        draw_current_position();
        draw_screw_text(pair);

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
    }

    // Update buttons
    update_expand_button();
    update_advance_buttons();
    update_history_buttons();
    update_color_buttons();
}

/** POSITION **/

// Class for a specific position view
function PositionView(pos) {
    for (var i = 0; i <= MAX_TURNS-1; i++) {
        var turn = document.createElement("div");
        turn.className = "turn turn-"+i;
        turn.style.top = i/MAX_TURNS*100+"%";
        turn.style.height = 100/MAX_TURNS+"%";
        turn.setAttribute("state", "hidden");
        pos.appendChild(turn);
    }

    for (var i = 0; i <= MAX_TURNS; i += TICK_SPACING) {
        var tickpos = i/MAX_TURNS*100+"%";
        ["ltick", "rtick"].map(function (className) {
            var tick = document.createElement("div");
            tick.className = className;
            tick.style.top = tickpos;
            pos.appendChild(tick);
        });
    }
    this.el = pos;
    this.curpos = 0;
}

PositionView.prototype = {
    // Draw color for a specific position (in turns)
    "draw_turn_status":function(pos, status, hit) {
        if (pos < 0) return;

        var turn = this.el.querySelector(".turn-"+pos);
        
        // Don't overwrite explicit information
        if (turn.getAttribute("state") === "hit" && !hit) return;

        turn.style.backgroundColor = ELECTRODE_STATUS[status].color;
        turn.setAttribute("state", hit ? "hit" : "skipped");
    },

    // Draw a history record
    "draw_action":function(at, pair_history) {
        var rec = pair_history[at];
        if (rec.action == "advance") {
            var last = Math.max(0, Math.round(this.curpos+rec.nturns-1));
            var oldstatus = get_electrode_status(at-1, pair_history);
            if (rec.nturns < 0) {
                for (var i = Math.round(this.curpos-1); i > last; i--) {
                    this.draw_turn_status(i, oldstatus, false);
                }
            } else {
                for (var i = Math.round(this.curpos); i < last; i++) {
                    this.draw_turn_status(i, oldstatus, false);
                }
            }
            this.draw_turn_status(last, rec.status, true);
            this.curpos += rec.nturns;
        } else if (rec.action == "status") {
            this.draw_turn_status(this.curpos-1, rec.status, true);
        }
    },

    // Shift display up or down
    "shift":function(nturns) {
        var turns = this.el.querySelectorAll(".turn");
        var shift = nturns/MAX_TURNS*100;
        for (var i = 0; i < turns.length; i++) {
            var turn = turns[i];
            var oldtop = turn.style.top;
            turn.style.top = parseFloat(oldtop.substr(oldtop, oldtop.length-1)) + shift + "%";
        }
    }
};

function init_ticks() {
    for (var i = 0; i <= MAX_TURNS; i += TICK_SPACING) {
        var tickpos = i/MAX_TURNS*100+"%";

        var lticklabel = document.createElement("div");
        lticklabel.className = "tick-label";
        lticklabel.style.top = tickpos;
        lticklabel.textContent = i;
        document.getElementById("pos-ltick-labels").appendChild(lticklabel);

        var rticklabel = document.createElement("div");
        rticklabel.className = "tick-label";
        rticklabel.style.top = tickpos;
        rticklabel.textContent = Math.round(i*MM_PER_TURN*10)/10;
        document.getElementById("pos-rtick-labels").appendChild(rticklabel);
    }
}

// Draw bar at current position on position axes
function draw_current_position() {
    var poses = document.querySelectorAll(".curpos");
    for (var i = 0; i < poses.length; i++) {
        poses[i].style.top = position.curpos/MAX_TURNS*100+"%";
    }
}

// Handle a click on the expand button
var mri_resizer;
var xcenter;
const MRI_HEIGHT = MAX_TURNS*MM_PER_TURN*2; // assumes 0.5 mm iso
function toggle_expanded_pos() {
    if (get_current_pair() === undefined) return;

    var histpos = document.getElementById("histpos");
    var projcont = document.getElementById("projection-container-container");
    if (document.body.hasAttribute("expanded-pos")) {
        document.body.removeAttribute("expanded-pos");
        projcont.removeAttribute("has-projection");
        document.getElementById("pos-expand-button").textContent = "\u21e2";
        empty_element(histpos);
        if (!mri_resizer) {
            window.removeEventListener("resize", mri_resizer, false);
        }
    } else {
        document.getElementById("pos-expand-button").textContent = "\u21e0";

        // Historical
        var grid = get_current_grid();
        var pair = get_current_pair();
        var keys = Object.keys(grid.histories);
        keys.reverse();
        for (var j = 0; j < keys.length; j++) {
            var histname = keys[j];
            var posdiv = document.createElement("div");
            posdiv.className = "posdiv";

            var upbutton = document.createElement("div");
            upbutton.className = "pos-button";
            upbutton.textContent = "\u21e3";

            var downbutton = document.createElement("div");
            downbutton.className = "pos-button";
            downbutton.textContent = "\u21e1";

            var posel = document.createElement("a");
            posel.className = "pos";
            posel.title = histname;
            var pos = new PositionView(posel);
            pos.shift(grid.offsets[histname]);

            var hist = grid.histories[histname][pair];
            if (!hist) continue;
            for (var i = 0; i < hist.length; i++) {
                pos.draw_action(i, hist);
            }

            upbutton.addEventListener("click", function() {
                pos.shift(1);
                grid.offsets[histname] += 1;
                save_grids();
            }, false);
            downbutton.addEventListener("click", function() {
                pos.shift(-1);
                grid.offsets[histname] -= 1;
                save_grids();
            }, false);

            posdiv.appendChild(upbutton);
            posdiv.appendChild(posel);
            posdiv.appendChild(downbutton);
            histpos.appendChild(posdiv);
        }

        // MRI
        if (pair !== undefined && grid.projection) {
            projcont.setAttribute("has-projection", "1");
            // x and y coordinates in image to extract
            var x = grid.electrodes.pairs[pair][0];
            var y = grid.electrodes.pairs[pair][1];
            var cd = Math.cos(grid.grid.rotation*Math.PI/180);
            var sd = Math.sin(grid.grid.rotation*Math.PI/180);

            var xp = x*cd + y*sd;
            var yp = -x*sd + y*cd;

            // Image coordinates of center of projection slice
            // Assumes that the png is 41 pseudo-coronal slices,
            // centered at the chamber center, with 121 px width
            xcenter = Math.round(yp*2 + 41)*121 + Math.round(xp*2 + 61);

            var img = document.getElementById("hidden-img");
            img.src = "";
            img.src = grid.projection;
            img.onload = function() {
                var canvas = document.getElementById("projection");
                canvas.width = 41;
                canvas.height = MRI_HEIGHT;

                var ctx = canvas.getContext('2d');
                var projection_offset = grid.projection_offset || 0;
                ctx.drawImage(img, xcenter-20, 51+projection_offset, 41, MRI_HEIGHT, 0, 0, 41, MRI_HEIGHT);

                canvas.style.width = canvas.offsetHeight*canvas.width/MRI_HEIGHT+"px";
                mri_resizer = function() {
                    canvas.style.width = canvas.offsetHeight*canvas.width/MRI_HEIGHT+"px";
                };
                window.addEventListener("resize", mri_resizer, false);
            };
        } else {
            projcont.removeAttribute("has-projection");
        }

        document.body.setAttribute("expanded-pos", "1");
    }
}

function update_expand_button() {
    set_disabled(document.getElementById("pos-expand-button"), get_current_pair() === undefined);
}

function move_projection(nturns) {
    var grid = get_current_grid();
    grid.projection_offset = (grid.projection_offset || 0) + nturns;

    var canvas = document.getElementById("projection");
    var ctx = canvas.getContext('2d');
    var img = document.getElementById("hidden-img");
    ctx.drawImage(img, xcenter-20, 51+grid.projection_offset, 41, MRI_HEIGHT, 0, 0, 41, MRI_HEIGHT);

    save_grids();
}

/** GRID **/

function select_grid(name) {
    if (name) {
        var selector = document.getElementById("grid-selector");
        var children = selector.children;
        for (var i = 0; i < children.length; i++) {
            if (children[i].value == name) {
                selector.selectedIndex = i;
                break;
            }
        }
    }
    draw_grid();
    update_expand_button();
    update_advance_buttons();
    update_history_buttons();
    document.getElementById("gridname").value = get_current_grid_name();
}


// Draw grid
function draw_grid() {
    var grid = document.getElementById("grid");
    empty_element(grid);

    // Add border to grid
    var border = document.createElement("div");
    border.id = "grid-border";
    grid.appendChild(border);

    var grid_info = get_current_grid();
    var gp = grid_info.grid;
    var ep = grid_info.electrodes;

    // Set grid background color
    var grid_container = document.getElementById("grid-container");
    if (grid_info.background) {
        grid_container.style.backgroundImage = "url('"+grid_info.background+"')";
    } else {
        grid_container.style.backgroundImage = "none";
    }

    // Draw electrode pairs and screws
    for (var i = 0; i < ep.pairs.length; i++) {
        var electrode_pair = ep.pairs[i];
        var skelpair = !ep.colors[i];
        if (skelpair) {
            var color = "white";
            var text_color = "black";
        } else {
            var color = ep.colors[i];
            var text_color = tinycolor(color).getBrightness() < 127 ? "white" : "black";
        }

        // Draw screws
        var screw = document.createElement("div");
        screw.className = "screw";
        if (skelpair) screw.classList.add("skeleton");
        screw.style.left = 50+((electrode_pair[0]-gp.screw_diameter/2+gp.screw_offset[0])/gp.grid_diameter)*100+"%";
        screw.style.bottom = 50+((electrode_pair[1]-gp.screw_diameter/2+gp.screw_offset[1])/gp.grid_diameter)*100+"%";
        screw.style.width = screw.style.height = gp.screw_diameter/gp.grid_diameter*100+"%";
        screw.style.backgroundColor = color;
        screw.style.color = text_color;
        screw.setAttribute("pair", i);
        screw.addEventListener("click", set_selection, false);

        var screw_text = document.createElement("div");
        screw_text.className = "screw-text";
        var screw_pos = document.createElement("div");
        screw_pos.className = "screw-position-text";
        var screw_status = document.createElement("div");
        screw_status.className = "screw-status-text";

        screw_text.appendChild(screw_pos);
        screw_text.appendChild(screw_status);
        screw.appendChild(screw_text);
        grid.appendChild(screw);

        for(var j = 0; j < gp.electrode_offsets.length; j++) {
            var electrode_number = ep.numbers[i] && ep.numbers[i][j];

            // Draw electrode
            var electrode = document.createElement("div");
            electrode.className = "electrode";
            if (electrode_number === undefined || skelpair) electrode.classList.add("skeleton");
            electrode.style.left = 50+((electrode_pair[0]-gp.electrode_diameter/2+gp.electrode_offsets[j][0])/gp.grid_diameter)*100+"%";
            electrode.style.bottom = 50+((electrode_pair[1]-gp.electrode_diameter/2+gp.electrode_offsets[j][1])/gp.grid_diameter)*100+"%";
            electrode.style.width = electrode.style.height = gp.electrode_diameter/gp.grid_diameter*100+"%";
            electrode.style.backgroundColor = color;
            electrode.style.color = tinycolor(color).getBrightness() < 127 ? "white" : "black";
            electrode.id = "electrode-"+i+"-"+j;
            electrode.setAttribute("pair", i);
            electrode.setAttribute("electrode", j);
            electrode.addEventListener("click", set_selection, false);

            // Draw text
            var electrode_text = document.createElement("div");
            electrode_text.className = "electrode-text";
            if (electrode_number) electrode_text.textContent = electrode_number;

            electrode.appendChild(electrode_text);
            grid.appendChild(electrode);
        }
    }

    rotation_change(gp.rotation, true);
    draw_screw_text_all();
}

// Get currently selected pair
function get_current_pair() {
    var screw = document.querySelector(".screw[selected]");
    if (!screw) return;
    var pair = screw.getAttribute("pair");
    return pair;
}

// Get name of currently selected grid
function get_current_grid_name() {
    return document.getElementById("grid-selector").selectedOptions[0].value;
}

// Get currently selected grid
function get_current_grid() {
    return grids[get_current_grid_name()];
}

// Get history for currently selected grid
function get_current_history() {
    return histories[get_current_grid_name()];
}

// Get redo stack for current grid and pair
function get_current_redo_stack() {
    return redo_stacks[get_current_grid_name()];
}

// Set selected electrode/channel. Called on click. this = screw or electrode
function set_selection() {
    var sel = this;

    // Save note
    unsaved_notes[get_current_pair()] = document.getElementById("note").value;
    
    // Not allowed to select disabled electrodes unless in setup mode
    if (sel.classList.contains("skeleton") && get_control_mode() != "setup") return;

    // Unselect other screws/electrodes
    var oldsel = document.querySelectorAll(".screw[selected], .electrode[selected]");
    for (var i = 0; i < oldsel.length; i++) {
        oldsel[i].removeAttribute("selected");
    }

    // Select this pair
    var newsel = document.querySelectorAll("[pair=\""+sel.getAttribute("pair")+"\"]");
    for (var i = 0; i < newsel.length; i++) {
        newsel[i].setAttribute("selected", "1");
    }
    if (sel.classList.contains("electrode") && get_control_mode() == "setup") {
        setup_electrode_number(sel);
    }

    // Clear note
    document.getElementById("note").value = unsaved_notes[get_current_pair()] || "";

    redraw_pair_info();
}

/** CONTROLS **/

// Get control mode.
function get_control_mode() {
    return document.querySelector("#controls-menu > .pure-menu-selected").getAttribute("mode");
}

// Set control mode. Called on click. el = button
function set_control_mode(el, event) {
    var oldmode = get_control_mode();
    var newmode = el.getAttribute("mode");

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

    if (newmode == "setup") {
        document.getElementById("grid").setAttribute("setup", "1");
    } else {
        document.getElementById("grid").removeAttribute("setup");
    }

    if (newmode == "history") {
        select_last_history_entry();
        // Otherwise the global click handler would undo the selection
        event.stopPropagation();
    }
}

/** SCREW **/

// Save history to localStorage
function save_grids() {
    localStorage["grids"] = JSON.stringify(grids);
}
function save_history() {
    localStorage["histories"] = JSON.stringify(histories);
}

// Add an action to the history and update UI
function do_action(rec) {
    rec.date = date_string();
    rec.time = time_string();
    var pair = get_current_pair();
    get_current_redo_stack()[pair] = [];
    var history = get_current_history()[pair];
    history.push(rec);
    draw_action(history.length-1);
    draw_screw_text(pair);
    update_advance_buttons();
    update_history_buttons();
    save_history();
}

// Update state of advance and retract buttons
function update_advance_buttons() {
    var pair = get_current_pair();
    if (!pair) {
        var butts = document.querySelectorAll(".advance-button, .retract-button, #note, #note-button");
        for (var i = 0; i < butts.length; i++) set_disabled(butts[i], true);
        return;
    }

    set_disabled(document.getElementById("note"), false);
    set_disabled(document.getElementById("add-note"), false);
    var advance_buttons = document.querySelectorAll(".advance-button");
    for (var i = 0; i < advance_buttons.length; i++) {
        var nturns = advance_buttons[i].getElementsByClassName("electrode-nturns");
        amount = nturns.length ? parseFloat(nturns[0].value) : 1;
        set_disabled(advance_buttons[i], amount != amount || amount < 1 || position.curpos + amount > MAX_TURNS || !pair);
    }

    var retract_buttons = document.querySelectorAll(".retract-button");
    for (var i = 0; i < retract_buttons.length; i++) {
        var nturns = retract_buttons[i].getElementsByClassName("electrode-nturns");
        amount = nturns.length ? parseFloat(nturns[0].value) : 1;
        set_disabled(retract_buttons[i], amount != amount || amount < 1 || position.curpos - amount < 0 || !pair);
    }
}

// Advance electrode. Called on advance/retract button click
function advance(nturns) {
    nturns = parseFloat(nturns);
    var pair = get_current_pair();
    if (!pair ||
        nturns != nturns ||
        position.curpos + nturns < 0 ||
        position.curpos + nturns > MAX_TURNS) return;
    do_action({
        "action":"advance",
        "nturns":nturns,
        "status":get_electrode_status()
    });
    draw_screw_text(pair);
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
function get_electrode_status(at, hist) {
    if (!hist) hist = get_current_history()[get_current_pair()];
    for (var i = at !== undefined ? at : hist.length-1; i >= 0; i--) {
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

    var pair_history = get_current_history()[pair];
    if (pair_history.length == 0 || !pair_history[pair_history.length-1].status) {
        do_action({
            "action":"status",
            "status":newstatus
        });
    } else {
        pair_history[pair_history.length-1].status = newstatus;
        draw_status_td(document.getElementById("history-body").lastChild.lastChild, newstatus);
        position.draw_turn_status(position.curpos-1, newstatus, true);
        save_history();
    }
    draw_screw_text(pair);
}

// Add a note to history
function add_note() {
    do_action({
        "action":"note",
        "note":document.getElementById("note").value
    });
    document.getElementById("note").value = "";
}

/** HISTORY **/

function select_last_history_entry() {
    // Set selection to last row
    var rows = document.getElementById("history-table").rows;
    if (rows.length > 1) {
        rows[rows.length-1].setAttribute("selected", "1");
    }
    update_history_buttons();
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

    // Get entries to remove, in reverse
    for (var i = 0; i < selected.length; i++) {
        remove.unshift(selected[i].getAttribute("entry"));
    }

    // Splice out
    var pair = get_current_pair();
    var pair_history = get_current_history()[pair];
    var recs = [];
    for (var i = 0; i < remove.length; i++) {
        recs[i] = pair_history[remove[i]];
        pair_history.splice(remove[i], 1);
    }

    // Add to redo stack
    get_current_redo_stack()[pair].push(new RedoStackEntry(remove.reverse(), recs));

    // Redraw
    redraw_pair_info();
    select_last_history_entry();
    save_history();
}

// Redo last undo
function redo(event) {
    var pair = get_current_pair();
    if (!get_current_redo_stack()[pair].length) return;

    // Splice back in what we removed last time
    var entry = get_current_redo_stack()[pair].pop();
    var pair_history = get_current_history()[pair];
    for (var i = 0; i < entry.indices.length; i++) {
        var index = entry.indices[i];
        pair_history.splice(index, 0, entry.recs[i]);
    }

    redraw_pair_info();

    // Select what was redone
    for (var i = 0; i < entry.indices.length; i++) {
        document.querySelector("#history-table tr[entry='"+entry.indices[i]+"']").setAttribute("selected", "1");
    }
    update_history_buttons();
    save_history();
}

function save() {
    var blob = new Blob([JSON.stringify({"grids":grids, "histories":histories}, false, "\t")], {type:"application/json;charset=utf-8"});
    saveAs(blob, "tracker "+date_string()+" "+time_string()+".json");
}

function get_tracker_stylesheet(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "tracker.css", true);
    xhr.responseType = "text";

    xhr.onload = function(e) {
        callback(this.response);
    };

    xhr.send();
}

function save_image() {
    get_tracker_stylesheet(function (stylesheet) {
        var canvas = document.getElementById("canvas");
        canvas.width = 1024;
        canvas.height = 1024;
        var ctx = canvas.getContext('2d');
        var data = '\
            <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">\
                <style type="text/css">'+stylesheet+'</style>\
                <foreignObject width="100%" height="100%">\
                    <div style="margin:[0, 4]px 4px 0" xmlns="http://www.w3.org/1999/xhtml" >\
                        <div id="grid-container">\
                            '+document.getElementById("grid-container").innerHTML+'\
                        </div>\
                    </div>\
                </foreignObject>\
            </svg>\
        ';

        // Trick from https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas
        var DOMURL = window.URL || window.webkitURL || window;

        var img = new Image();
        var svg = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
        var url = DOMURL.createObjectURL(svg);

        img.onload = function () {
          ctx.drawImage(img, 0, 0);
          DOMURL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            saveAs(blob, "grid.png");
          });
        }

        img.src = url;
    });
}

function update_history_buttons() {
    var can_undo = false, can_redo = false, pair;
    if ((pair = get_current_pair())) {
        can_undo = get_current_history()[pair].length != 0;
        can_redo = get_current_redo_stack()[pair].length != 0;
    }
    set_disabled(document.getElementById("undo-button"), !can_undo);
    set_disabled(document.getElementById("redo-button"), !can_redo);
}

/** SETUP **/

function confirm_action(name, callback) {
    display_dialog(name, "confirm", function (status) {
        if (status) {
            callback();
        }
    });
}

function save_historical() {
    var datestr = "";
    for (var gridname in histories) {
        var pair_history = histories[gridname];
        for (var i=0; i<pair_history.length; i++) {
            var history = pair_history[i];
            if (history.length > 0 && history[history.length-1].date > datestr) {
                datestr = history[history.length-1].date;
            }
        }
    }
    if (datestr == "") datestr = date_string();
    var historyname = disambiguate(datestr, grids[Object.keys(grids)[0]].histories);
    for (var gridname in grids) {
        var grid = grids[gridname],
            pair_history = histories[gridname],
            redo_stack = redo_stacks[gridname];
        grid.histories[historyname] = JSON.parse(JSON.stringify(histories[gridname]));
        grid.offsets[historyname] = 0;
        for (var i = 0; i < grid.electrodes.pairs.length; i++) {
            pair_history[i] = [];
            redo_stack[i] = [];
        }
    }
    redraw_pair_info();
    draw_screw_text_all();
    save_grids();
    save_history();
}

function load() {
    document.getElementById("hidden-load-input").click();
}

function load_file(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
        var data = JSON.parse(event.target.result);
        grids = data.grids;
        histories = data.histories;

        init_redo_stacks();
        init_grids();
        redraw_pair_info();
        save_grids();
        save_history();
    };
    reader.readAsText(file);
}

function reset_history() {
    var grid = get_current_grid();
    var pair_history = get_current_history();
    var redo_stack = get_current_redo_stack();
    for (var i = 0; i < grid.electrodes.pairs.length; i++) {
        pair_history[i] = [];
        redo_stack[i] = [];
    }
    redraw_pair_info();
    draw_screw_text_all();
    save_history();
}

function clear_grid() {
    var grid = get_current_grid();
    grid.electrodes.colors = [];
    grid.electrodes.numbers = [];
    draw_grid();
    reset_history();
    save_grids();
    save_history();
}

function new_grid() {
    var name = disambiguate("Untitled Grid", grids);
    grids[name] = grid_template();
    histories[name] = new_history(grid_template().electrodes.pairs);
    new_redo_stack(name);
    init_grids(true);
    save_grids();
    save_history();
}

function delete_grid() {
    if (Object.keys(grids).length <= 1) return;
    var name = get_current_grid_name();
    delete grids[name];
    delete histories[name];
    delete redo_stacks[name];
    init_grids();
    save_grids();
    save_history();
}

// Set grid name. Called when typing in grid name box
function grid_name_change(newname) {
    var oldname = get_current_grid_name();
    var grid = grids[oldname];
    var history = histories[oldname];
    var redo_stack = redo_stacks[oldname];
    var curopt = document.getElementById("grid-selector").selectedOptions[0];
    curopt.value = curopt.textContent = newname;
    delete grids[oldname];
    grids[newname] = grid;
    delete histories[oldname];
    histories[newname] = history;
    delete redo_stacks[oldname];
    redo_stacks[newname] = redo_stack;
    save_grids();
    save_history();
}

// Set rotation. Called when slider is moved or rotation is changed
function rotation_change(newrot, dontsave) {
    document.getElementById("rotation").value = newrot;
    document.getElementById("rotation-slider").value = newrot;

    var grid = document.getElementById("grid");
    grid.style.transform = grid.style.webkitTransform = "rotate("+newrot+"deg)";

    var electrodes = document.querySelectorAll(".electrode-text, .screw-text");
    for (var i = 0; i < electrodes.length; i++) {
        electrodes[i].style.transform = electrodes[i].style.webkitTransform = 
            "translateX(-50%) translateY(-50%) rotate("+(-newrot)+"deg)";
    }

    get_current_grid().grid.rotation = newrot;
    if(!dontsave) save_grids();
}

// Set well background
function set_background() {
    document.getElementById("hidden-background-input").click();
}

function load_background(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
        get_current_grid()["background"] = event.target.result;
        draw_grid();
        save_grids();
    };
    reader.readAsDataURL(file);
}

// Set well projection
function set_projection() {
    document.getElementById("hidden-projection-input").click();
}

function load_projection(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
        get_current_grid()["projection"] = event.target.result;
        save_grids();
    };
    reader.readAsDataURL(file);
}

// Initialize color selction buttons
function init_color_buttons() {
    for (var i = 0; i < COLORS.length; i++) {
        var butt = document.createElement("span");
        butt.id = "color-"+i;
        butt.className = "color-button";
        butt.addEventListener("click", select_this_color, false);
        butt.style.backgroundColor = COLORS[i];
        document.getElementById("color").appendChild(butt);
    }
}

// Handle color selections
function select_this_color() {
    select_color(this);
}

function select_color(el) {
    var pair = get_current_pair();
    var grid = get_current_grid();
    if (!pair) return;

    var children = document.getElementById("color").children;
    for (var i = 0; i < children.length; i++) {
        if (children[i] == el) {
            children[i].setAttribute("selected", "1");
        } else {
            children[i].removeAttribute("selected");
        }
    }
    
    var sel = document.querySelectorAll(".screw[selected], .electrode[selected]");
    if (el.id == "color-disabled") {
        delete grid.electrodes.colors[pair];
        for (var i = 0; i < sel.length; i++) {
            sel[i].style.backgroundColor = "#fff";
            sel[i].classList.add("skeleton");
        }
    } else {
        var color = el.style.backgroundColor;
        grid.electrodes.colors[pair] = color;
        for (var i = 0; i < sel.length; i++) {
            if (!sel[i].classList.contains("electrode") ||
                (grid.electrodes.numbers[sel[i].getAttribute("pair")] &&
                 grid.electrodes.numbers[sel[i].getAttribute("pair")][sel[i].getAttribute("electrode")] !== undefined)) {
                sel[i].classList.remove("skeleton");
            }
            sel[i].style.backgroundColor = color;
            sel[i].style.color = tinycolor(color).getBrightness() < 127 ? "white" : "black";
        }
    }
    save_grids();
}

// Update disabled state of color buttons
function update_color_buttons() {
    var pair = get_current_pair();
    var grid = get_current_grid();
    if (!pair) {
        document.getElementById("color").setAttribute("disabled", "1");
        return;
    }
    document.getElementById("color").removeAttribute("disabled");
    if (!grid.electrodes.colors[pair]) {
        select_color(document.getElementById("color-disabled"));
        return;
    }
    for (var i = 0; i < COLORS.length; i++) {
        if (COLORS[i] == grid.electrodes.colors[pair]) {
            select_color(document.getElementById("color-"+i));
            return;
        }
    }
}

// Edit electrode number
function setup_electrode_number(el) {
    el.firstChild.style.display = "none";

    var inp = document.createElement("input");
    inp.type = "text";
    inp.style.color = el.style.color;
    inp.addEventListener("change", change_this_electrode_number, false);
    el.appendChild(inp);
    inp.select();
}

function change_this_electrode_number() {
    change_electrode_number(this);
}

function change_electrode_number(el) {
    var val = el.value, valint = parseInt(val), electrode = el.parentNode;
    electrode.firstChild.style.display = "block";
    electrode.removeChild(el);
    if (valint != val) return;

    var pair = electrode.getAttribute("pair");
    var grid = get_current_grid();
    if (!grid.electrodes.numbers[pair]) {
        grid.electrodes.numbers[pair] = [];
    }
    grid.electrodes.numbers[pair][electrode.getAttribute("electrode")] = valint;
    electrode.firstChild.textContent = valint;

    if (grid.electrodes.colors[pair]) {
        electrode.classList.remove("skeleton");
    }

    save_grids();
}

/** INITIALIZATION **/

document.addEventListener("click", function () {
    var inps = document.querySelectorAll(".electrode > input");
    for (var i = 0; i < inps.length; i++) {
        change_electrode_number(inps[i]);
    }
}, true);

// Not sure why the attribute won't work
set_disabled(document.getElementById("note"), true);
init_redo_stacks();
var position = new PositionView(document.getElementById("pos"));
init_ticks();
init_grids();
init_electrode_status();
init_color_buttons();
