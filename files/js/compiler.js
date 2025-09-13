function handleSpecial(lines) {
    // Replaces forever loops with repeat infinity for now
    let code = [];
    for (let line of lines) {
        if (line.trim().startsWith("forever()") && line.trim().endsWith("{")) {
            code.push('repeat("Infinity") {');
        } else {
            code.push(line);
        }
    }
    return code;
}

function translateV2ToV1(source) {
    // Convert ScratchScript v2 syntax into the v1 function style understood by
    // the existing compiler. The translator now covers events, control blocks,
    // assignments, list operations, actions and wraps loose top level
    // statements in an implicit `whenGreenFlagClicked` block.
    const lines = source.replaceAll("\r", "").split("\n");
    const events = [];
    const loose = [];
    const ctxStack = []; // values: 'event' or 'main'

    const pushLine = (line) => {
        const ctx = ctxStack[ctxStack.length - 1] || "main";
        if (ctx === "event") {
            events.push(line);
        } else {
            loose.push(line);
        }
    };

    for (let raw of lines) {
        let line = raw.trim();
        if (line === "") {
            continue;
        }

        let m;

        // Events
        if (ctxStack.length === 0 && line === "when greenFlag") {
            events.push("whenGreenFlagClicked() {");
            ctxStack.push("event");
            continue;
        }
        if (ctxStack.length === 0 && (m = line.match(/^when key \"(.+)\" pressed$/))) {
            events.push(`whenKeyPressed("${m[1]}") {`);
            ctxStack.push("event");
            continue;
        }
        if (ctxStack.length === 0 && line.startsWith("when sprite ") && line.endsWith(" clicked")) {
            events.push("whenThisSpriteClicked() {");
            ctxStack.push("event");
            continue;
        }

        // Block endings and else
        if (line === "end") {
            pushLine("}");
            ctxStack.pop();
            continue;
        }
        if (line === "else") {
            pushLine("} else {");
            continue;
        }

        // Control blocks
        if (line === "forever") {
            pushLine("forever() {");
            ctxStack.push(ctxStack[ctxStack.length - 1] || "main");
            continue;
        }
        if ((m = line.match(/^repeat until (.+)$/))) {
            pushLine(`repeatUntil(${m[1]}) {`);
            ctxStack.push(ctxStack[ctxStack.length - 1] || "main");
            continue;
        }
        if ((m = line.match(/^repeat (.+)$/))) {
            pushLine(`repeat(${m[1]}) {`);
            ctxStack.push(ctxStack[ctxStack.length - 1] || "main");
            continue;
        }
        if ((m = line.match(/^if (.+)$/))) {
            pushLine(`if(${m[1]}) {`);
            ctxStack.push(ctxStack[ctxStack.length - 1] || "main");
            continue;
        }

        // Actions
        if ((m = line.match(/^move (.+) steps$/))) {
            pushLine(`moveSteps(${m[1]})`);
            continue;
        }
        if ((m = line.match(/^turn (.+) degrees$/))) {
            pushLine(`turnRight(${m[1]})`);
            continue;
        }
        if ((m = line.match(/^go to x: (.+) y: (.+)$/))) {
            pushLine(`goToXY(${m[1]}, ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^say \"(.+)\" for (.+)$/))) {
            pushLine(`sayForSecs("${m[1]}", ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^say \"(.+)\"$/))) {
            pushLine(`say("${m[1]}")`);
            continue;
        }
        if ((m = line.match(/^ask \"(.+)\"$/))) {
            pushLine(`ask("${m[1]}")`);
            continue;
        }

        // Variable and list operations
        if ((m = line.match(/^change ([A-Za-z_][A-Za-z0-9_]*) by (.+)$/))) {
            pushLine(`changeVar("${m[1]}", ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^add (.+) to ([A-Za-z_][A-Za-z0-9_]*)$/))) {
            pushLine(`addToList(${m[1]}, "${m[2]}")`);
            continue;
        }
        if ((m = line.match(/^remove (.+) from ([A-Za-z_][A-Za-z0-9_]*)$/))) {
            pushLine(`deleteFromList(${m[1]}, "${m[2]}")`);
            continue;
        }
        if ((m = line.match(/^([A-Za-z_][A-Za-z0-9_]*) = (.+)$/))) {
            pushLine(`setVar("${m[1]}", ${m[2]})`);
            continue;
        }

        // Fallback to original line if no rule matched
        pushLine(line);
    }

    const final = [];
    if (loose.length > 0) {
        final.push("whenGreenFlagClicked() {");
        final.push(...loose);
        final.push("}");
    }
    final.push(...events);
    return final.join("\n");
}

function getParamsArray(params) {
    // Parses a function string and results the params
    let str = params.slice(1, params.length - 1);
    if (str == "") {
        return [];
    }
    if (str.trim().endsWith(",")) {
        compileError("Unexpected ','");
    }
    let parenLevel = 0;
    let output = [];
    let start = 0;
    let inString = false;
    // console.log(str);
    let i = 0;
    for (char of str) {
        if (!inString) {
            if (char == "(") {
                parenLevel += 1;
            }
            if (char == ")") {
                parenLevel -= 1;
            }
        }
        if (char == '"') {
            inString = !inString;
        }
        if (char == "," && parenLevel === 0 && !inString) {
            output.push(str.slice(start, i).trim());
            start = i + 1;
        }
        i++;
    }
    output.push(str.slice(start).trim());
    return output;
}

function compileStatement(state, codeLines) {
    compileBlock(parseBlock(line), blockID, state.nestingList.length); // Changes block ID by however many blocks were compiled
    blockList[id.toString()].next = (blockID + 1).toString();
}

function clearVariablesAndLists(keepGlobal) {
    if (keepGlobal) {
        for (key of Object.keys(variables)) {
            if (!variables[key].global) {
                delete variables[key];
            }
        }
        for (key of Object.keys(lists)) {
            if (!lists[key].global) {
                delete lists[key];
            }
        }
    } else {
        variables = {};
        lists = {};
    }
}

function compileSprite(sprite) {
    spriteBeingCompiled = sprite;
    // Translate v2 source to the original function style before compiling
    let translated = translateV2ToV1(codeList[sprite]);
    let codeLines = translated.split("\n");
    codeLines = handleSpecial(codeLines); // Handles forever loops
    let currentLine = 0;
    blockY = 0;
    firstBlockInScript = true;
    scriptBlockCount = 0;
    blockList = {};
    // variables = {};
    // lists = {};
    clearVariablesAndLists(true);
    lineNum = 0;
    let state = { currentLine: currentLine, nestingList: [] };

    while (state.currentLine < codeLines.length) {
        compileStatement(state, codeLines);
    }
    blockID += 2;
    let newSprite = {
        isStage: false,
        name: sprite == "stage" ? "Stage" : Base64.decode(sprite),
        variables: getVariables(),
        lists: getLists(),
        blocks: blockList,
        comments: {},
        currentCostume: 0,
        broadcasts: {},
    };
}
