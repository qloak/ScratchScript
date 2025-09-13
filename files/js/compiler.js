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
    // Convert ScratchScript v2 syntax into the v1 function style that the
    // existing compiler understands. The translator only handles a limited
    // subset of the language but covers the most common blocks such as
    // events, control blocks, assignments and a handful of actions.
    const lines = source.replaceAll("\r", "").split("\n");
    const out = [];

    for (let raw of lines) {
        const line = raw.trim();
        if (line === "") {
            out.push("");
            continue;
        }

        // Events
        let m;
        if (line === "when greenFlag") {
            out.push("whenGreenFlagClicked() {");
            continue;
        }
        if ((m = line.match(/^when key \"(.+)\" pressed$/))) {
            out.push(`whenKeyPressed("${m[1]}") {`);
            continue;
        }
        if (line.startsWith("when sprite ") && line.endsWith(" clicked")) {
            out.push("whenThisSpriteClicked() {");
            continue;
        }

        // Block endings and else
        if (line === "end") {
            out.push("}");
            continue;
        }
        if (line === "else") {
            out.push("} else {");
            continue;
        }

        // Control blocks
        if (line === "forever") {
            out.push("forever() {");
            continue;
        }
        if ((m = line.match(/^repeat until (.+)$/))) {
            out.push(`repeatUntil(${m[1]}) {`);
            continue;
        }
        if ((m = line.match(/^repeat (.+)$/))) {
            out.push(`repeat(${m[1]}) {`);
            continue;
        }
        if ((m = line.match(/^if (.+)$/))) {
            out.push(`if(${m[1]}) {`);
            continue;
        }

        // Actions
        if ((m = line.match(/^move (.+) steps$/))) {
            out.push(`moveSteps(${m[1]})`);
            continue;
        }
        if ((m = line.match(/^turn (.+) degrees$/))) {
            out.push(`turnRight(${m[1]})`);
            continue;
        }
        if ((m = line.match(/^go to x: (.+) y: (.+)$/))) {
            out.push(`goToXY(${m[1]}, ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^say \"(.+)\" for (.+)$/))) {
            out.push(`sayForSecs("${m[1]}", ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^say \"(.+)\"$/))) {
            out.push(`say("${m[1]}")`);
            continue;
        }
        if ((m = line.match(/^ask \"(.+)\"$/))) {
            out.push(`ask("${m[1]}")`);
            continue;
        }

        // Variable and list operations
        if ((m = line.match(/^change ([A-Za-z_][A-Za-z0-9_]*) by (.+)$/))) {
            out.push(`changeVar("${m[1]}", ${m[2]})`);
            continue;
        }
        if ((m = line.match(/^add (.+) to ([A-Za-z_][A-Za-z0-9_]*)$/))) {
            out.push(`addToList(${m[1]}, "${m[2]}")`);
            continue;
        }
        if ((m = line.match(/^remove (.+) from ([A-Za-z_][A-Za-z0-9_]*)$/))) {
            out.push(`deleteFromList(${m[1]}, "${m[2]}")`);
            continue;
        }
        if ((m = line.match(/^([A-Za-z_][A-Za-z0-9_]*) = (.+)$/))) {
            out.push(`setVar("${m[1]}", ${m[2]})`);
            continue;
        }

        // Fallback to original line if no rule matched
        out.push(line);
    }

    return out.join("\n");
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
function compileStatement(state, codeLines) {
        compileBlock(parseBlock(line), blockID, state.nestingList.length); // Changes block ID by however many blocks were compiled
        blockList[id.toString()].next = (blockID + 1).toString();
    }
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
