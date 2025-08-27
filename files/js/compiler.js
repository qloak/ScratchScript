// --- NEW GLOBALS ---
let customBlocks = {};
let nextParentOverride = null;
let startedFirstScript = false;

// --- UPDATED: compileStatement() ---
function compileStatement(state, codeLines) {
    let line = codeLines[state.currentLine++];
    lineNum = state.currentLine;
    line = line.trim();
    if (line.startsWith("//") || line === "") return;

    if (line === "}") {
        if (state.nestingList.length === 0) compileError("Unexpected '}'");
        // terminate the most-recent open stack at this visual nesting
        let keys = Object.keys(blockList);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].next && blockList[key].nestingLevel === state.nestingList.length) {
                blockList[key].next = null;
                break;
            }
        }
        state.nestingList.pop();
        return;
    }

    // script { ... }
    if (line === "script{" || line === "script {" ) {
        if (startedFirstScript) blockY += 90;
        else startedFirstScript = true;
        firstBlockInScript = true;
        state.nestingList.push({ kind: "SCRIPT" });
        return;
    }

    // }else{
    if (line.replaceAll(" ", "") === "}else{") {
        let keys = Object.keys(blockList);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].next && blockList[key].nestingLevel === state.nestingList.length) {
                blockList[key].next = null;
                break;
            }
        }
        let found = false;
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].opcode === "control_if" && blockList[key].nestingLevel === state.nestingList.length - 1) {
                blockList[key].opcode = "control_if_else";
                blockList[key].inputs.SUBSTACK2 = [2, (blockID + 1).toString()];
                found = true;
                break;
            }
        }
        if (!found) compileError("could not find if");
        return;
    }

    // block [ ... ] {
    if (line.startsWith("block [") && (line.endsWith("{") || line.endsWith("{ "))) {
        let header = line.slice(6).trim(); // after 'block'
        let bracketStart = header.indexOf("[");
        let bracketEnd = header.lastIndexOf("]");
        if (bracketStart === -1 || bracketEnd === -1 || bracketEnd < bracketStart) compileError("Malformed custom block header");
        let inside = header.slice(bracketStart + 1, bracketEnd);
        let meta = parseCustomBlockHeader(inside); // { proccode, argNames, argIds, protoId }
        let defId = emitProcedureDefinition(meta, state.nestingList.length);

        // make the next compiled statement become the body (parented to def)
        nextParentOverride = defId;
        state.nestingList.push({ kind: "PROC", defId });
        return;
    }

    // repeat/while/if(...) { ... }
    if (line.startsWith("repeat") || line.startsWith("while") || line.startsWith("if(") || line.startsWith("if (")) {
        let repeatCountExpression = parseBlock(line.slice(0, line.length - 2));
        let repeatID = blockID + 1;
        compileBlock(repeatCountExpression, blockID, state.nestingList.length);
        blockList[repeatID.toString()].inputs.SUBSTACK = [2, (blockID + 1).toString()];
        let nestingDepth = state.nestingList.length;
        state.nestingList.push({ kind: "CTL", id: repeatID });
        while (state.nestingList.length > nestingDepth) compileStatement(state, codeLines);
        blockList[repeatID.toString()].next = (blockID + 1).toString();
        return;
    }

    // ordinary statement
    let id = blockID + 1;
    compileBlock(parseBlock(line), blockID, state.nestingList.length);
    blockList[id.toString()].next = (blockID + 1).toString();
}

// --- UPDATED: compileBlock() (only the top section) ---
function compileBlock(code, parent, nestingLevel) {
    blockID += 1;
    let myID = blockID;
    let parsedCode = code;
    let block = {};

    let funcName = parsedCode.shift();
    if (!funcName) compileError("Function name is undefined");
    if (!blockData[funcName]) compileError(`There is no function called '${funcName}'`);

    block.next = null;
    block.shadow = false;
    block.fields = {};
    block.inputs = {};
    block.topLevel = false;
    block.nestingLevel = nestingLevel;
    block.opcode = blockData[funcName].opcode;

    // parent/topLevel handling (with one-shot override for PROC bodies)
    if (nextParentOverride) {
        block.parent = nextParentOverride.toString();
        block.topLevel = false;
        // attach definition.next -> first body block
        if (!blockList[nextParentOverride.toString()].next)
            blockList[nextParentOverride.toString()].next = myID.toString();
        nextParentOverride = null;
    } else if (firstBlockInScript) {
        block.x = 0;
        block.y = blockY;
        block.parent = null;
        block.topLevel = true;
        firstBlockInScript = false;
    } else {
        block.parent = parent.toString();
    }

    if (blockData[funcName].type === "stack") blockY += 70;

    // ... keep the rest of your compileBlock() exactly as-is ...
    // (all your input handling, variables/lists/broadcasts, dropdown logic, etc.)
    // At the very end:
    blockList[myID.toString()] = block;
}

// --- NEW: parseCustomBlockHeader() ---
function parseCustomBlockHeader(s) {
    // s example: label:"Do" reporter:"stuff" label:"and check if" boolean:"thing" label:"is true"
    let parts = tokenizeHeaderKVs(s);
    let tokens = [];
    let argNames = [];
    for (let i = 0; i < parts.length; i++) {
        let { key, val } = parts[i];
        if (key === "label") tokens.push({ kind: "label", text: val });
        else if (key === "reporter") { tokens.push({ kind: "rep", name: val }); argNames.push(val); }
        else if (key === "boolean") { tokens.push({ kind: "bool", name: val }); argNames.push(val); }
        else compileError(`Unknown custom block part '${key}'`);
    }
    if (!tokens.length) compileError("Custom block header is empty");

    // build proccode
    let codePieces = [];
    tokens.forEach(t => {
        if (t.kind === "label") codePieces.push(t.text.trim());
        if (t.kind === "rep")   codePieces.push("%s");
        if (t.kind === "bool")  codePieces.push("%b");
    });
    let proccode = codePieces.join(" ").replace(/\s+/g, " ").trim();

    let argIds = argNames.map(() => Math.round(Math.random()*1e15).toString());
    let protoId = Math.round(Math.random()*1e15).toString();
    return { tokens, proccode, argNames, argIds, protoId };
}

// --- NEW: tokenizeHeaderKVs() ---
function tokenizeHeaderKVs(s) {
    // parses key:"value" sequences; values can contain spaces and punctuation
    let out = [];
    let i = 0;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i])) i++;
        let startKey = i;
        while (i < s.length && /[a-zA-Z]/.test(s[i])) i++;
        let key = s.slice(startKey, i).trim();
        while (i < s.length && /\s/.test(s[i])) i++;
        if (s[i] !== ":") compileError("Expected ':' in custom block header");
        i++;
        while (i < s.length && /\s/.test(s[i])) i++;
        if (s[i] !== '"') compileError('Expected quoted value in custom block header');
        i++;
        let valStart = i, val = "", inEsc = false;
        for (; i < s.length; i++) {
            let c = s[i];
            if (inEsc) { val += c; inEsc = false; continue; }
            if (c === "\\") { inEsc = true; continue; }
            if (c === '"') break;
            val += c;
        }
        if (i >= s.length || s[i] !== '"') compileError("Unterminated string in custom block header");
        i++; // consume closing quote
        out.push({ key, val });
    }
    return out;
}

// --- NEW: emitProcedureDefinition() ---
function emitProcedureDefinition(meta, nestingLevel) {
    let defId = (blockID + 1).toString();
    let prototypeId = meta.protoId;

    // prototype (shadow)
    let proto = {
        parent: defId,
        next: null,
        inputs: {},
        fields: {},
        shadow: true,
        opcode: "procedures_prototype",
        topLevel: false,
        nestingLevel,
        mutation: {
            proccode: meta.proccode,
            argumentids: JSON.stringify(meta.argIds),
            argumentnames: JSON.stringify(meta.argNames),
            warp: "false"
        }
    };

    // definition (top-level)
    let def = {
        parent: null,
        next: null,                // will be set when first body stmt compiles
        inputs: { CUSTOM_BLOCK: [1, prototypeId] },
        fields: {},
        shadow: false,
        opcode: "procedures_definition",
        topLevel: true,
        x: 0,
        y: blockY,
        nestingLevel
    };

    // register and advance
    blockList[defId] = def;
    blockList[prototypeId] = proto;
    blockID += 2;
    blockY += 70;

    // keep for calls
    customBlocks[meta.proccode] = { argNames: meta.argNames, argIds: meta.argIds, protoId: prototypeId, defId: defId };
    return defId;
}

// --- UPDATED: compile() (only the init/loop) ---
async function compile() {
    let compiled;
    try {
        blockID = 0;
        broadcasts = {};
        clearVariablesAndLists();
        customBlocks = {};
        nextParentOverride = null;
        startedFirstScript = false;

        compiled = {
            targets: [],
            monitors: [],
            extensions: [],
            meta: {
                semver: "3.0.0",
                vm: "0.2.0",
                agent: "",
                platform: { name: "TurboWarp", url: "https://turbowarp.org/" }
            },
        };

        spriteBeingCompiled = null;
        for (let sprite of spriteList) compiled.targets.push(compileSprite(sprite));
        compiled.targets[0].broadcasts = getBroadcasts();
    } catch (e) {
        if (!e.message.startsWith("CompileError")) alert("An unexpected error was encountered while compiling — " + e.message);
        else { alert(e.message); console.error(e); }
        return null;
    }

    let zip = new JSZip();
    zip.file("project.json", JSON.stringify(compiled, null, 4));
    for (let assetID of Object.keys(assets.list)) if (isAssetUsed(assetID)) zip.file(assetID, assets.list[assetID]);
    let blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    let a = await blob.arrayBuffer();
    window.output10 = a;
    return a;
}
