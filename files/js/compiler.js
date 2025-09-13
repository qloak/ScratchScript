// -------------------
// NEW GLOBALS
// -------------------
let customBlocks = {}; // registry of custom block definitions

function genID() {
    return Math.round(Math.random() * 1e15).toString();
}

// -------------------
// PARSE CUSTOM SIGNATURE
// -------------------
function parseCustomSignature(name, argspec) {
    // argspec is like: ("add" (input1) "+" (input2) "if" <boolean> "is true")
    let tokens = [];
    let current = "";
    let inQuote = false;
    let inParen = false;
    let inAngle = false;

    for (let i = 0; i < argspec.length; i++) {
        let c = argspec[i];
        if (c === '"' && !inParen && !inAngle) {
            inQuote = !inQuote;
            if (!inQuote && current.length > 0) {
                tokens.push({ type: "label", value: current });
                current = "";
            }
            continue;
        }
        if (c === "(" && !inQuote && !inAngle) {
            inParen = true;
            current = "";
            continue;
        }
        if (c === ")" && inParen) {
            inParen = false;
            if (current.trim()) {
                tokens.push({ type: "input", value: current.trim(), kind: "string" });
            }
            current = "";
            continue;
        }
        if (c === "<" && !inQuote && !inParen) {
            inAngle = true;
            current = "";
            continue;
        }
        if (c === ">" && inAngle) {
            inAngle = false;
            if (current.trim()) {
                tokens.push({ type: "input", value: current.trim(), kind: "boolean" });
            }
            current = "";
            continue;
        }

        if (inQuote || inParen || inAngle) {
            current += c;
        }
    }

    // Build proccode + arg list
    let proccodeParts = [];
    let argList = [];
    for (let t of tokens) {
        if (t.type === "label") {
            proccodeParts.push(t.value);
        } else if (t.type === "input") {
            argList.push({ name: t.value, kind: t.kind });
            if (t.kind === "boolean") {
                proccodeParts.push("%b");
            } else {
                proccodeParts.push("%s"); // Scratch often just uses %s for text/number
            }
        }
    }

    return {
        proccode: [name].concat(proccodeParts).join(" "),
        argList: argList
    };
}

// -------------------
// EMIT CUSTOM DEFINITION + PROTOTYPE
// -------------------
function emitCustomDefinition(name, proccode, argList) {
    let defID = (++blockID).toString();
    let protoID = (++blockID).toString();

    let argIDs = argList.map(() => genID());
    customBlocks[name] = {
        proccode,
        argIDs,
        argNames: argList.map(a => a.name),
        warp: false
    };

    // definition block (hat)
    blockList[defID] = {
        opcode: "procedures_definition",
        next: null,
        parent: null,
        inputs: { custom_block: [1, protoID] },
        fields: {},
        shadow: false,
        topLevel: true,
        x: 100,
        y: blockY
    };
    blockY += 120;

    // prototype block
    blockList[protoID] = {
        opcode: "procedures_prototype",
        next: null,
        parent: defID,
        inputs: {},
        fields: {},
        shadow: true,
        topLevel: false,
        mutation: {
            tagName: "mutation",
            children: [],
            proccode: proccode,
            argumentids: JSON.stringify(argIDs),
            argumentnames: JSON.stringify(argList.map(a => a.name)),
            argumentdefaults: JSON.stringify(argList.map(a => (a.kind === "boolean" ? false : ""))),
            warp: "false"
        }
    };
}

// -------------------
// EXTEND compileStatement TO HANDLE `define`
// -------------------
const oldCompileStatement = compileStatement;
compileStatement = function (state, codeLines) {
    let line = codeLines[state.currentLine++].trim();
    lineNum = state.currentLine;

    if (line.startsWith("define ")) {
        let sig = line.slice("define ".length, line.lastIndexOf("{")).trim();
        let name = sig.split("(")[0].trim();
        let argspec = sig.slice(sig.indexOf("("));

        let { proccode, argList } = parseCustomSignature(name, argspec);
        emitCustomDefinition(name, proccode, argList);

        // compile body inside { ... }
        let nestingDepth = state.nestingList.length;
        state.nestingList.push("CUSTOMBLOCK");
        while (state.currentLine < codeLines.length) {
            let nextLine = codeLines[state.currentLine].trim();
            if (nextLine === "}") {
                state.currentLine++;
                state.nestingList.pop();
                break;
            }
            compileStatement(state, codeLines);
        }
        return;
    }

    // fallback to original logic
    state.currentLine--; // step back so old function sees correct line
    return oldCompileStatement(state, codeLines);
};

// -------------------
// EXTEND compileBlock TO HANDLE CUSTOM CALLS
// -------------------
const oldCompileBlock = compileBlock;
compileBlock = function (code, parent, nestingLevel) {
    let funcName = Array.isArray(code) ? code[0] : null;
    if (funcName && customBlocks[funcName]) {
        blockID++;
        let myID = blockID;
        let cb = customBlocks[funcName];
        let params = code.slice(1);

        let block = {
            opcode: "procedures_call",
            next: null,
            parent: parent ? parent.toString() : null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: false,
            nestingLevel: nestingLevel,
            mutation: {
                tagName: "mutation",
                children: [],
                proccode: cb.proccode,
                argumentids: JSON.stringify(cb.argIDs),
                warp: cb.warp.toString()
            }
        };

        for (let i = 0; i < cb.argIDs.length; i++) {
            let argID = cb.argIDs[i];
            let param = params[i] !== undefined ? params[i] : "";
            if (typeof param === "object") {
                block.inputs[argID] = [3, (blockID + 1).toString()];
                compileBlock(param, myID, nestingLevel);
            } else {
                block.inputs[argID] = [1, [10, param]];
            }
        }

        blockList[myID.toString()] = block;
        return;
    }

    return oldCompileBlock(code, parent, nestingLevel);
};
