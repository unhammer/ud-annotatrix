"use strict"

var FORMAT = "";
var FILENAME = 'ud-annotatrix-corpus.conllu'; // default name
var ROOT = './lib/';
var CONTENTS = "";
var AVAILABLESENTENCES = 0;
var CURRENTSENTENCE = 0;
var TABLE_VIEW = false;
var TABLE_COLUMNS_HEADERS = {"ID":0,"FORM":1,"LEMMA":2,"UPOSTAG":3,"XPOSTAG":4,"FEATS":5,"HEAD":6,"DEPREL":7,"DEPS":8,"MISC":9};
var TABLE_COLUMNS_VISIBILITY = {0:true,1:true,2:true,3:true,4:true,5:true,6:true,7:true,8:true,9:true};
var RESULTS = [];
var LOC_ST_AVAILABLE = false;
var SERVER_RUNNING = false;
var AMBIGUOUS = false;
var LABELS = [];


function main() {
    head.js(
        ROOT + 'ext/jquery-3.2.1.min.js',
        ROOT + 'ext/jquery-ui-1.12.1/jquery-ui.min.js',
        ROOT + 'ext/cytoscape.min.js',
        // ROOT + 'ext/cytoscape-panzoom.js',
        ROOT + 'ext/undomanager.js',
        ROOT + 'ext/popper.min.js',
        ROOT + 'ext/bootstrap.min.js',
        ROOT + 'ext/l20n.js',

        // CoNLL-U parser from https://github.com/FrancessFractal/conllu
        ROOT + 'ext/conllu/conllu.js',

        // native project code
        ROOT + 'CG2conllu.js',
        ROOT + 'SD2conllu.js',
        ROOT + 'Brackets2conllu.js',
        ROOT + 'converters.js',
        ROOT + 'gui.js',
        ROOT + 'visualiser.js',
        ROOT + 'validation.js',
        ROOT + 'cy-style.js'
    );

    head.ready(function() {

        fetch('running').then(
            function(data) {
                console.log("Response from server, status: " + data["status"]);
                getCorpusData();
                SERVER_RUNNING = true;
            }); // TODO: to get rid of the error, read about promisses: https://qntm.org/files/promise/promise.html

        $(document).keyup(keyUpClassifier); // TODO: causes errors if called before the cy is initialised

        // undo support
        window.undoManager = new UndoManager();
        setUndos(window.undoManager);

        // trying to load the corpus from localStorage
        if (storageAvailable('localStorage')) {
            LOC_ST_AVAILABLE = true;
            if (localStorage.getItem("corpus") != null) {
                CONTENTS = localStorage.getItem("corpus");
                loadDataInIndex();
            };
        }
        else {
            console.log("localStorage is not avaliable :(")
            // add a nice message so the user has some idea how to fix this
            var warnMsg = document.createElement('p');
            warnMsg.innerHTML = "Unable to save to localStorage, maybe third-party cookies are blocked?";
            var warnLoc = document.getElementById('warning');
            warnLoc.appendChild(warnMsg);

        }

        // $("#indata").keyup(drawTree);
        $("#indata").bind("keyup", drawTree);
        $("#indata").bind("keyup", focusOut);
        $("#RTL").bind("change", switchRtlMode);
        $("#vertical").bind("change", switchAlignment);
        loadFromUrl();
    });

    document.getElementById('filename').addEventListener('change', loadFromFile, false);

    setTimeout(function(){
        if (SERVER_RUNNING) {
            $("#save").css("display", "block")
                .css("background-color", NORMAL);
        }
    }, 500);
}


function addHandlers() {
    // NOTE: If you change the style of a node (e.g. its selector) then
    // you also need to update the event handler here
    cy.on('click', 'node.wf', drawArcs);
    cy.on('cxttapend', 'edge.dependency', selectArc);
    cy.on('cxttapend', 'edge.error', selectArc);
    cy.on('cxttapend', 'edge.incomplete', selectArc);
    cy.on('click', 'node.pos', changeNode);
    cy.on('click', '$node > node', selectSup);
    cy.on('cxttapend', 'node.wf', changeNode);
    cy.on('click', 'edge.dependency', changeNode);
    cy.on('click', 'edge.error', changeNode);
    cy.on('click', 'edge.incomplete', changeNode);
}


function loadFromUrl(argument) {
    //check if the URL contains arguments

    var parameters = window.location.search.slice(1);
    parameters = parameters.split('&')[1]
    if (parameters){
        var variables = parameters.map(function(arg){
            return arg.split('=')[1].replace(/\+/g, " ");
        });

        $("#indata").val(variables[0]);

        drawTree();
    }
}


//Load Corpora from file
function loadFromFile(e) {
    CONTENTS = "";
    var file = e.target.files[0];
    FILENAME = file.name;

    // check if the code is invoked
    var ext = FILENAME.split(".")[FILENAME.split(".").length - 1]; // TODO: should be more beautiful way
    if (ext == "txt") {
        FORMAT = "plain text";
    }

    if (!file) {
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        CONTENTS = e.target.result;
        localStorage.setItem("corpus", CONTENTS);
        loadDataInIndex();
    };
    reader.readAsText(file);
}


function addSent() {
        AVAILABLESENTENCES = AVAILABLESENTENCES + 1;
        showDataIndiv();
}

function removeCurSent() {
    var conf = confirm("Do you want to remove the sentence?");
    if (conf) {
        var curSent = CURRENTSENTENCE;
        $("#indata").val("");
        CONTENTS = getTreebank();
        loadDataInIndex();
        CURRENTSENTENCE = curSent;
        if (CURRENTSENTENCE >= AVAILABLESENTENCES) {CURRENTSENTENCE--};
        showDataIndiv();
    }
}


function loadDataInIndex() {
    RESULTS = [];
    AVAILABLESENTENCES = 0;
    CURRENTSENTENCE = 0;

    if (FORMAT == "plain text") {
        var splitted = CONTENTS.match(/[^ ].+?[.!?](?=( |$))/g);
    // } else if (FORMAT == undefined) {
    //     var splitted = [];
    } else {
        var splitted = CONTENTS.split("\n\n");
    }

    console.log('loadDataInIndex |' + FORMAT + " | " + splitted.length)
    for (var i = splitted.length - 1; i >= 0; i--) {
        if (splitted[i].trim() === "") {
            splitted.splice(i, 1);
        }
    }

    AVAILABLESENTENCES = splitted.length;
    console.log('loadDataInIndex |' + FORMAT + " | AVAILABLESENTENCES = " + AVAILABLESENTENCES)

    if (AVAILABLESENTENCES == 1 || AVAILABLESENTENCES == 0) {
        document.getElementById('nextSenBtn').disabled = true;
    } else {
        document.getElementById('nextSenBtn').disabled = false;
    }

    for (var i = 0; i < splitted.length; ++i) {
        var check = splitted[i];
        RESULTS.push(check);
    }
    showDataIndiv();
}

function showDataIndiv() {
    // This function is called each time the current sentence is changed to update
    // the CoNLL-U in the textarea.
    console.log('showDataIndiv() ' + RESULTS.length + " // " + CURRENTSENTENCE);
    if(RESULTS[CURRENTSENTENCE] != undefined) {
      document.getElementById('indata').value = (RESULTS[CURRENTSENTENCE]);
    } else {
      document.getElementById('indata').value = "";
    }
    if(AVAILABLESENTENCES != 0) {
        document.getElementById('currentsen').value = (CURRENTSENTENCE+1);
    } else { 
        document.getElementById('currentsen').value = 0;
    }
    document.getElementById('totalsen').innerHTML = AVAILABLESENTENCES;
    updateTable(); // Update the table view at the same time 
    drawTree();
}

function goToSenSent() {
    RESULTS[CURRENTSENTENCE] = document.getElementById("indata").value;
    CURRENTSENTENCE = parseInt(document.getElementById("currentsen").value) - 1;
    if (CURRENTSENTENCE < 0)  {
        CURRENTSENTENCE = 0;
    }
    if (CURRENTSENTENCE > (AVAILABLESENTENCES - 1))  {
        CURRENTSENTENCE = AVAILABLESENTENCES - 1;
    }
    if (CURRENTSENTENCE < (AVAILABLESENTENCES - 1)) {
        document.getElementById("nextSenBtn").disabled = false;
    }
    if (CURRENTSENTENCE == 0) {
        document.getElementById("prevSenBtn").disabled = true;
    }

    clearLabels();
    showDataIndiv();
}

function prevSenSent() {
    RESULTS[CURRENTSENTENCE] = document.getElementById("indata").value;
    CURRENTSENTENCE--;
    if (CURRENTSENTENCE < 0)  {
        CURRENTSENTENCE = 0;
    }
    if (CURRENTSENTENCE < (AVAILABLESENTENCES - 1)) {
        document.getElementById("nextSenBtn").disabled = false;
    }
    if (CURRENTSENTENCE == 0) {
        document.getElementById("prevSenBtn").disabled = true;
    }
    clearLabels();
    showDataIndiv();
}

//When Navigate to next item
function nextSenSent() {
    RESULTS[CURRENTSENTENCE] = document.getElementById("indata").value;
    CURRENTSENTENCE++;
    if(CURRENTSENTENCE >= AVAILABLESENTENCES) {
      CURRENTSENTENCE = AVAILABLESENTENCES;
    }
    if (CURRENTSENTENCE >= (AVAILABLESENTENCES - 1)) {
        document.getElementById("nextSenBtn").disabled = true;
    }
    if (CURRENTSENTENCE > 0) {
        document.getElementById("prevSenBtn").disabled = false;
    }
    clearLabels();
    showDataIndiv();
}

function clearLabels() {
    LABELS = [];
    var htmlLabels = document.getElementById('treeLabels');
    while (htmlLabels.firstChild) {
      htmlLabels.removeChild(htmlLabels.firstChild);
    }
}

//Export Corpora to file
function exportCorpora() {
    var finalcontent = getTreebank();

    var link = document.createElement('a');
    var mimeType = 'text/plain';
    document.body.appendChild(link); // needed for FF
    link.setAttribute('download', FILENAME);
    link.setAttribute('href', 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(finalcontent));
    link.click();
}


function clearCorpus() {
    CONTENTS = "";
    AVAILABLESENTENCES = 0;
    CURRENTSENTENCE = 0;
    RESULTS = [];
    FORMAT = ""
    localStorage.setItem("corpus", "");
    $("#indata").val("");
    showDataIndiv()
    window.location.reload();
    drawTree();
}


function getTreebank() {

    RESULTS[CURRENTSENTENCE] = document.getElementById("indata").value;
    var finalcontent = "";
    // loop through all the trees
    for(var x=0; x < RESULTS.length; x++){
        // add them to the final file, but get rid of any trailing whitespace
        finalcontent = finalcontent + RESULTS[x].trim();
        // if it's not the last tree, add two ewlines (e.g. one blank line)
        if(x != ((RESULTS.length)-1)){
            finalcontent = finalcontent + "\n\n";
        }
    }
    // output final newline
    return finalcontent + "\n\n";
}


function drawTree() {
    // This function is called whenever the input area changes
    //
    try {
        cy.destroy();
    } catch (err) {};

    var content = $("#indata").val();
    // remove extra spaces at the end of lines. #89
    content = content.replace(/ +\n/, '\n');
    $("#indata").val(content);
    FORMAT = detectFormat(content);

    $("#detected").html("Detected: " + FORMAT + " format");
    console.log('drawTree() ' + FORMAT);
    if (FORMAT == "CoNLL-U") {
        $("#viewOther").hide();
        $("#viewCG").removeClass("active");
        $("#viewOther").removeClass("active");
        $("#viewConllu").addClass("active");
    } else if (FORMAT == "CG3") {
        $("#viewOther").hide();
        $("#viewConllu").removeClass("active");
        $("#viewOther").removeClass("active");
        $("#viewCG").addClass("active");
    } else {
        $("#viewOther").show();
        $("#viewOther").addClass("active");
        $("#viewConllu").removeClass("active");
        $("#viewCG").removeClass("active");
        $("#viewOther").text(FORMAT);
    }


    if (FORMAT == "CG3") {
        content = CG2conllu(content)
        if (content == undefined) {
            AMBIGUOUS = true;
        } else {
            AMBIGUOUS = false;
        }
    };

    if (FORMAT == "SD") {
        content = SD2conllu(content);
    }

    if (FORMAT == "Brackets") {
        content = Brackets2conllu(content);
    }


    if (FORMAT == "CoNLL-U" || (FORMAT == "CG3" && !AMBIGUOUS) || FORMAT == "SD" || FORMAT == "Brackets") {
        var newContent = cleanConllu(content);
        // If there are >1 CoNLL-U format sentences is in the input, treat them as such
        if(newContent.match(/\n\n/)) {
            conlluMultiInput(newContent);
        }
        if(newContent != content) {
            content = newContent;
            $("#indata").val(content);
        }

        conlluDraw(content);
        var inpSupport = $("<div id='mute'>"
            + "<input type='text' id='edit' class='hidden-input'/></div>");
        $("#cy").prepend(inpSupport);
        addHandlers();
    }

    if (LOC_ST_AVAILABLE) {
        localStorage.setItem("corpus", getTreebank()); // saving the data
    }

    if (AMBIGUOUS) {
        cantConvertCG();
    } else {
        clearWarning();
    }
}

function cleanConllu(content) {
    // if we don't find any tabs, then convert >1 space to tabs
    // TODO: this should probably go somewhere else, and be more
     // robust, think about vietnamese D:
    var res = content.search("\n");
    if(res < 0) {
        return content;
    }
    // maybe someone is just trying to type conllu directly...
    var res = (content.match(/_/g)||[]).length;
    if(res <= 2) {
        return content;
    }
    var res = content.search("\t");
    var spaceToTab = false;
    // If we don't find any tabs, then we want to replace multiple spaces with tabs
    if(res < 0) {
        spaceToTab = true;
    }
    // remove blank lines
    var lines = content.trim().split("\n");
    var newContent = "";
    for(var i = 0; i < lines.length; i++) {
        var newLine = lines[i].trim();
//        if(newLine.length == 0) {
//            continue;
//        }
        // If there are no spaces and the line isn't a comment, then replace more than one space with a tab
        if(newLine[0] != "#" && spaceToTab) {
            newLine = newLine.replace(/  */g, "\t");
        }
        // strip the extra tabs/spaces at the end of the line
        newContent = newContent + newLine + "\n";
    }
    return newContent;
}


function detectFormat(content) {
    clearLabels();
    //TODO: too many "hacks" and presuppositions. refactor.

    content = content.trim();

    if(content == "") {
        console.log('[0] detectFormat() WARNING EMPTY CONTENT');
        return  "Unknown";
    }
 
    var firstWord = content.replace(/\n/g, " ").split(" ")[0];

    console.log('[0] detectFormat() ' + content.length + " | " + FORMAT);
    console.log('[1] detectFormat() ' + content);

    // handling # comments at the beginning
    if (firstWord[0] === '#'){
        var following = 1;
        while (firstWord[0] === '#' && following < content.length){
            // TODO: apparently we need to log the thing or it won't register???
            firstWord = content.split("\n")[following];
            // pull out labels and put them in HTML, TODO: this probably
            // wants to go somewhere else.
            if(firstWord.search('# labels') >= 0) {
                var labels = firstWord.split("=")[1].split(" ");
                for(var i = 0; i < labels.length; i++) {
                    var seen = false;
                    for(var j = 0; j < LABELS.length; j++) {
                        if(labels[i] == LABELS[j]) {
                            seen = true;
                        }
                    }
                    if(!seen) {
                        LABELS.push(labels[i]);
                    }
                }
                var htmlLabels = $('#treeLabels');
                for(var k = 0; k < LABELS.length; k++) {
                    if(LABELS[k].trim() == "") {
                        continue;
                    }
                    htmlLabels.append($('<span></span>')
                        .addClass('treebankLabel')
                        .text(LABELS[k])
                    );
                }
                console.log("FOUND LABELS:" + LABELS);
            }
            following ++;
        }
    }

    var trimmedContent = content.trim("\n");
    //console.log(trimmedContent + ' | ' + trimmedContent[trimmedContent.length-1]);
    if (firstWord.match(/"<.*/)) {
    // SAFE: The first token in the string should start with "<
        FORMAT = "CG3";
    } else if (firstWord.match(/1/)) {
    // UNSAFE: The first token in the string should be 1
        FORMAT = "CoNLL-U";
    } else if (trimmedContent.includes("(") && trimmedContent.includes("\n") && (trimmedContent.includes(")\n") || trimmedContent[trimmedContent.length-1] == ")")) {
    // SAFE: To be SDParse as opposed to plain text we need at least 2 lines.
    // UNSAFE: SDParse should include at least one line ending in ) followed by a newline
    // UNSAFE: The last character in the string should be a )
        FORMAT = "SD";
    // UNSAFE: The first character is an open square bracket
    } else if (firstWord.match(/\[/)) {
                FORMAT = "Brackets";
    // TODO: better plaintext recognition
    } else if (!trimmedContent.includes("\t") && trimmedContent[trimmedContent.length-1] != ")") {
    // SAFE: Plain text and SDParse should not include tabs. CG3/CoNLL-U should include tabs
    // UNSAFE: SDParse should end the line with a ), but plain text conceivably could too
        FORMAT = "plain text";
    } else {
        FORMAT = "Unknown";
    }
    console.log('[3] detectFormat() ' + FORMAT);

    return FORMAT
}


function saveOnServer(evt) {
    var finalcontent = getTreebank();

    // sending data on server
    var treebank_id = location.href.split('/')[4];
    $.ajax({
        type: "POST",
        url: '/save',
        data: {
            "content": finalcontent,
            "treebank_id": treebank_id
        },
        dataType: "json",
        success: function(data){
            console.log('Load was performed.');
        }
    });
}


function getCorpusData() {
    var treebank_id = location.href.split('/')[4];
    $.ajax({
        type: "POST",
        url: "/load",
        data: {"treebank_id": treebank_id},
        dataType: "json",
        success: loadData
    });
}


function loadData(data) {
    console.log("loadData");
    if (data["content"]) {
        CONTENTS = data["content"];
    }
    loadDataInIndex();
}


function showHelp() {
    /* Opens help in a new tab. */
    var win = window.open("help.html", '_blank');
    win.focus();
}


function storageAvailable(type) {
    /* Taken from https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API */
    try {
        var storage = window[type],
            x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage.length !== 0;
    }
}

function tableEditCell(loc) { 
    // Yes I'm sorry I don't know Jquery, I'm sure this could be done much better.
    loc = loc.trim();
    var table = document.getElementById("indataTable");
    var cell = document.getElementById(loc).innerHTML;
    console.log("tableEditCell() " + loc + " " + cell);

    // Update the CoNLL-U and set the value in the textbox 

    var conllu = "";
    
    for (var r = 1, n = table.rows.length; r < n; r++) {
        for (var c = 0, m = table.rows[r].cells.length; c < m; c++) {
            var thisCell = table.rows[r].cells[c].childNodes[0].innerHTML;
            if(thisCell.trim() == "") {
                thisCell = "_";
            }
//            console.log("@" + table.rows[r].cells[c].innerHTML + " // " + thisCell);
            if(c > 0) {
              conllu = conllu + "\t" + thisCell;
            } else {
              conllu = conllu + thisCell;
            }
        }
        conllu = conllu + "\n";
    }
    console.log("!@", conllu);
    $("#indata").val(conllu);
 
    // Draw tree 

    drawTree();
}

function toggleTableView() {
    // This function toggles the table view
    $("#indata").toggle();
    $("#indataTable").toggle();
    $("#tableViewButton").toggleClass('fa-code', 'fa-table');
    if(TABLE_VIEW) {
        TABLE_VIEW = false;
    } else { 
        TABLE_VIEW = true;
    }
}

function updateTable() {
    // Update the data in the table from the data in the textarea
    $("#indataTable tbody").empty();
    var conlluLines = $("#indata").val().split("\n");
    var row = 0;

    for(let line of conlluLines) {
        if(line.trim() == "") {
            continue;
        }
        console.log(line);
        if(line[0] == '#') { 
            $("#indataTable tbody").append('<tr style="display:none" id="table_"' + row + '"><td colspan="10"><span>' + line + '</span></td></tr>'); 
        } else { 
            var lineRow = $("<tr>");
            var cells = line.split("\t");
            for(var col = 0; col < 10; col++) {
                var valid = [true, "", {}];
                var loc = "table_" + row + ":" + col;
                if(cells[col].trim() == "") { 
                    cells[col] = "_";
                } 
                if(cells[col] != "_") {
                    if(col == 3) {
                        valid = is_upos(cells[col]);
                    }
                    if(col == 7) {
                        valid = is_udeprel(cells[col]);
                    }
                }

                let td = $("<td>");
                let span0 = $('<span data-value="' + cells[col] + '"onBlur="updateTable();" onKeyUp="tableEditCell(\''+loc+'\');" id="' + loc + '" contenteditable>' + cells[col] + '</span>');
                td.append(span0);
                if(!valid[0]) { 
                    let span1 = $('<span><i class="fa fa-exclamation-triangle" aria-hidden="true"></i></span>');
                    document.l10n.formatValue(valid[1], valid[2]).then(function(t) { span1.attr("title", t);});
                    td.append(span1);
                }
                lineRow.append(td);
            }
            $("#indataTable tbody").append(lineRow); 
        }
        row += 1;
    }

    // Make sure hidden columns stay hidden
    // This could probably go in the for loop above
    for(var col = 0; col < 10; col++) {
        if(!TABLE_COLUMNS_VISIBILITY[col]) {
            $("[id^=table_][id$=" + col+"]").css("display","none");
        }
    }
// Sushain's original, more beautiful code:
//    $("#indataTable tbody").append(
//        $("#indata").val().split("\n")
//            .filter(line => line.length && !line.startsWith("#"))
//            .map(rowText => $("<tr>").append(
//                rowText.split("\t").map(cellText => $("<td>").text(cellText))
//            ))
//    );
}

function toggleTableColumn(col) {
   // Toggle the visibility of a table column. It only hides the values in the cells,
   // not the column header. 
   // @col = the column that was clicked

   // the HTML id of the table cell is #table_<ROW>:<COLUMN>, the hash maps 
   // from column ID to column offset
   var colId = TABLE_COLUMNS_HEADERS[col];
   var button = $("#tableCol_" + col).text();  // The text (e.g. dot)

   console.log("toggleTableColumn() " + " " + col + " " + button);
   $("#tableCol_" + col).empty(); // Empty the text

   if(button == "⚪") {  // If the column is currently hidden, make it visible
     $("#tableCol_" + col).append("⚫");
     $("#tableHead_" + col).css("display","inline-block");
     $("[id^=table_][id$=" + colId+"]").css("display","inline-block");
     TABLE_COLUMNS_VISIBILITY[colId] = true;
   } else { // If the column is visible make it hidden
     $("#tableCol_" + col).append("⚪");
     $("#tableHead_" + col).css("display","none");
     $("[id^=table_][id$=" + colId+"]").css("display","none");
     TABLE_COLUMNS_VISIBILITY[colId] = false;
   }

   // TODO: Maybe use greying out of the headers in addition to/instead of 
   // the filled/empty dots to indicate hidden or not
}

function toggleCodeWindow() {
    $("#codeVisibleButton").toggleClass('fa-chevron-down', 'fa-chevron-up');
    console.log('toggleCodeWindow()');
    if(TABLE_VIEW) {
        $("#indataTable").toggle('show');
    } else { 
        $("#indata").toggle('show');
    }
}

function focusOut(key) {
    if (key.which == ESC) {
        this.blur();
    }
}

window.onload = main;
