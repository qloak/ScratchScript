/**
 * ScratchScript Compiler (extended)
 * - Adds `script { ... }` block grouping
 * - Adds custom block definitions:
 *     block [label:"Do" reporter:"stuff" label:"and check if" boolean:"thing" label:"is true"] {
 *         sayForSecs($stuff, 1)
 *         if ($thing) { say("ok") }
 *     }
 *   Call by proccode:
 *     Do %r and check if %b is true("Hello", true)
 *
 * Notes from the person who touched this last:
 *   I tried to keep this minimally invasive: bolt on custom-blocks as a simple
 *   macro system so it plays nicely with the existing compiler, without
 *   rewriting half the pipeline. If you need “real” Scratch procedures,
 *   we can swap the macro expander for proper `procedures_*` later.
 */

/* -------------------------- Minor helpers up top -------------------------- */

function handleSpecial(lines) {
    // Human note: Scratch's "forever" is syntactic sugar; map it to repeat Infinity for now.
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

function getParamsArray(params) {
    // Split "fn(a, pickRandom(1, 2), \"x, y\")" into ["a","pickRandom(1, 2)","\"x, y\""]
    let str = params.slice(1, params.length - 1);
    if (str == "") return [];
    if (str.trim().endsWith(",")) compileError("Unexpected ','");

    let parenLevel = 0, output = [], start = 0, inString = false, i = 0;
    for (char of str) {
        if (!inString) {
            if (char == "(") parenLevel += 1;
            if (char == ")") parenLevel -= 1;
        }
        if (char == '"') inString = !inString;
        if (parenLevel == 0 && char == "," && !inString) {
            output.push(str.slice(start, i).trim());
            start = i + 1;
        }
        i += 1;
    }
    output.push(str.slice(start, i).trim());
    return output;
}

function parseBlock(str) {
    // Turn a line like: sayForSecs(pickRandom(1, 10), 2.5) into ["sayForSecs", ["pickRandom",1,10], 2.5]
    str = str.trim();
    if (str.startsWith('"')) return str.slice(1, str.length - 1); // String literal
    if (!isNaN(parseFloat(str))) return parseFloat(str);           // Number literal

    if (isNaN(parseFloat(str)) && !str.startsWith('"')) {
        if (!(str.startsWith("$") || str.startsWith("#") || str == "true" || str == "false")) {
            if (!str.includes("(")) compileError("Missing '('");
            if (!str.includes(")")) compileError("Missing ')'");

            let functionName = str.slice(0, str.indexOf("(")).trim();
            let paramsString = str.slice(str.indexOf("("));
            let paramsStringsArray = getParamsArray(paramsString);
            let paramTermsArray = paramsStringsArray.map((s) => parseBlock(s));

            return [functionName].concat(paramTermsArray);
        } else {
            if (str == "true" || str == "false") return str;
            // variable or list marker emitted earlier in parsing
            if (str.startsWith("#")) return listStartThing + str;
            return variableStartThing + str;
        }
    }
}

/* ------------------------------ Assets helpers --------------------------- */

function getVariables() {
    let v = {};
    for (let key of Object.keys(variables)) {
        if (spriteBeingCompiled != "stage") {
            if (!variables[key].global) v[variables[key].id] = [key, 0];
        } else {
            v[variables[key].id] = [key, 0];
        }
    }
    return v;
}

function getLists() {
    let v = {};
    for (let key of Object.keys(lists)) {
        if (spriteBeingCompiled != "stage") {
            if (!lists[key].global) v[lists[key].id] = [key, []];
        } else {
            v[lists[key].id] = [key, []];
        }
    }
    return v;
}

function getBroadcasts() {
    let v = {};
    for (let key of Object.keys(broadcasts)) {
        v[broadcasts[key].id] = key;
    }
    return v;
}

function getCostumes(sprite) {
    let createdCostumeList = [];
    for (let costume of assets.sprites[sprite].costumeList) {
        let newCostume = {
            name: costume.name,
            bitmapResolution: 1,
            dataFormat: costume.hash.split(".").pop(),
            assetId: costume.hash.split(".")[0],
            md5ext: costume.hash,
            rotationCenterX: Math.round(costume.width / 2),
            rotationCenterY: Math.round(costume.height / 2),
        };
        createdCostumeList.push(newCostume);
    }
    return createdCostumeList;
}

function getSounds(sprite) {
    let createdSoundList = [];
    for (let sound of assets.sprites[sprite].soundList) {
        let newSound = {
            name: sound.name,
            dataFormat: sound.hash.split(".").pop(),
            assetId: sound.hash.split(".")[0],
            md5ext: sound.hash,
        };
        createdSoundList.push(newSound);
    }
    return createdSoundList;
}

function compileError(err) {
    throw { name: "CompileError", message: `CompileError on line ${lineNum} in sprite ${getSpriteName(spriteBeingCompiled, true)} — ${err}` };
}

/* These tokens tag variables/lists during the early parse so we can recognize them later.
 * They’re intentionally ugly to avoid collisions with user strings. */
const variableStartThing = "$`!jsf☠d_Why are you looking here_89ISf[$!☠$~$";
const listStartThing     = "#`!jsf☠d_Why are you looking here_89ISf[#]☠$~$";

/* --------------------------- State / global vars ------------------------- */

let blockID;
let spriteList;
let codeList;
let assets;
let blockData; // Provided by project
let blockY;
let firstBlockInScript;
let blockList;
let variables;
let lists;
let broadcasts;
let lineNum;

// --- Custom block support (macro-style). Added by qloak. ---
// Each custom def is stored under its proccode so we can call it by that text.
let __customBlockCounter = 0;
/**
 * customBlocks[proccode] = {
 *   proccode: "Do %r and check if %b is true",
 *   argNames: ["stuff","thing"],
 *   argKinds: ["reporter","boolean"],
 *   body: [ ...string lines... ],
 *   internalName: "__custom_k3"
 * }
 */
const customBlocks = Object.create(null);

/* ------------------------ Block assembly + typing ------------------------ */

function compileBlock(code, parent, nestingLevel) {
    // note: `code` is already parsed to an array like ["sayForSecs", <arg1>, <arg2>]
    blockID += 1;
    let myID = blockID;

    let parsedCode = code.slice(); // don’t mutate caller
    let funcName = parsedCode.shift();
    let params = parsedCode;

    if (!funcName) compileError("Function name is undefined");

    // If this is a custom macro call (we use the proccode string as funcName), expand inline.
    if (!blockData[funcName] && customBlocks[funcName]) {
        expandAndCompileCustomCall(funcName, params, parent, nestingLevel);
        return; // Important: macro expansion compiles its own blocks.
    }

    if (!blockData[funcName]) {
        compileError(`There is no function called '${funcName}'`);
    }

    let block = {};
    block.next = null;
    block.shadow = false;
    block.fields = {};
    block.inputs = {};
    block.topLevel = false;
    block.nestingLevel = nestingLevel;
    block.opcode = blockData[funcName].opcode;

    if (firstBlockInScript) {
        block.x = 0;
        block.y = blockY;
        block.parent = null;
        block.topLevel = true;
        firstBlockInScript = false;
    } else {
        block.parent = parent.toString();
    }

    if (blockData[funcName].type == "stack") {
        // spacing nudge so stacks don't overlap each other vertically
        blockY += 70;
    }

    // Handle inputs
    for (let [i, param] of params.entries()) {
        if (typeof param == "object") {
            // reporter/boolean block as input
            block.inputs[blockData[funcName].inputs[i]] = [3, (blockID + 1).toString()];
            compileBlock(param, myID, nestingLevel);
        } else {
            // dropdown-block subtype (kept from original)
            if (blockData[funcName].dropdown == "block") {
                let dropBlockID = (blockID + 1).toString();
                let dropBlock = {
                    parent: myID.toString(),
                    next: null,
                    inputs: {},
                    fields: {},
                    shadow: true,
                };
                let item = blockData[funcName].dropdownOpcode[i];
                if (item != null) {
                    if (typeof param == "object") {
                        block.inputs[i] = {};
                    } else {
                        dropBlock.opcode = item;
                        dropBlock.fields[blockData[funcName].inputs[i]] = [param, null];
                        block.inputs[blockData[funcName].inputs[i]] = [1, dropBlockID];
                        blockList[dropBlockID] = dropBlock;
                        blockID += 1;
                        continue;
                    }
                }
            }

            if (blockData[funcName].dropdownInputs) {
                // square dropdown in spec
                if (blockData[funcName].dropdownInputs[i] != null) {
                    block.fields[blockData[funcName].inputs[i]] = [param, null];

                    // wire variable/list IDs if needed
                    if (blockData[funcName].category) {
                        if (blockData[funcName].category == "variable") {
                            let varID;
                            if (variables[param]) {
                                varID = variables[param].id;
                            } else {
                                varID = Math.round(Math.random() * 1e15).toString();
                                variables[param] = { id: varID, value: 0 };
                                if (spriteBeingCompiled == "stage") variables[param].global = true;
                            }
                            block.fields[blockData[funcName].inputs[i]][1] = varID;
                        }
                        if (blockData[funcName].category == "list") {
                            let listID;
                            if (lists[param]) {
                                listID = lists[param].id;
                            } else {
                                listID = Math.round(Math.random() * 1e15).toString();
                                lists[param] = { id: listID, value: [] };
                                if (spriteBeingCompiled == "stage") lists[param].global = true;
                            }
                            block.fields[blockData[funcName].inputs[i]][1] = listID;
                        }
                    }
                    continue; // handled
                }
            }

            // Broadcast special-case
            if (blockData[funcName].opcode == "event_whenbroadcastreceived") {
                let brID;
                if (broadcasts[param]) {
                    brID = broadcasts[param].id;
                } else {
                    brID = Math.round(Math.random() * 1e15).toString();
                    broadcasts[param] = { id: brID };
                }
                block.fields[blockData[funcName].inputs[i]] = [param, brID];
                continue;
            }

            // Variable / list inputs that come in as tagged markers
            if (param.toString().startsWith(variableStartThing)) {
                let varName = param.toString().slice(variableStartThing.length + 1); // +1 to skip the real "$"
                block.inputs[blockData[funcName].inputs[i]] = [3, [12, varName, variables[varName].id]];
            } else if (param.toString().startsWith(listStartThing)) {
                let listName = param.toString().slice(listStartThing.length + 1);   // +1 to skip the real "#"
                block.inputs[blockData[funcName].inputs[i]] = [3, [13, listName, lists[listName].id]];
            } else {
                // normal literal
                block.inputs[blockData[funcName].inputs[i]] = [1, [10, param]];
            }
        }
    }

    // Simple arity check (kept)
    if (params && blockData[funcName].inputs) {
        let got = params.length;
        let want = blockData[funcName].inputs.length;
        if (got != want) compileError(`Got ${got} input${got == 1 ? "" : "s"}, expected ${want} input${want == 1 ? "" : "s"}`);
    }

    blockList[myID.toString()] = block;
}

const nestingType = {
    REPEAT: "repeat",
    IFTHEN: "ifthen",
    IFTHENELSE: "ifthenelse",
};

/* ------------------------------ Script parsing --------------------------- */

// Recognize script and custom-block headers
function isScriptHeader(line) {
    line = line.trim();
    if (line.endsWith("() {")) return true;               // hat block (whenGreenFlagClicked, etc.)
    if (line.startsWith("script") && line.endsWith("{")) return true; // script { ... }
    if (line.startsWith("block ") && line.endsWith("{")) return true; // custom block def
    return false;
}

// Extract block bodies for each script/definition
function extractScriptBlocks(codeLines) {
    let scripts = [];
    let i = 0;

    while (i < codeLines.length) {
        let line = codeLines[i].trim();
        if (line === "" || line.startsWith("//")) { i++; continue; }

        if (isScriptHeader(line)) {
            let script = { header: line, body: [], startLine: i + 1 };
            i++; // after header
            let braceCount = 1;
            while (i < codeLines.length && braceCount > 0) {
                let bodyLine = codeLines[i];
                let trimmed = bodyLine.trim();
                for (let ch of trimmed) {
                    if (ch === '{') braceCount++;
                    if (ch === '}') braceCount--;
                }
                if (braceCount > 0) script.body.push(bodyLine);
                i++;
            }
            scripts.push(script);
        } else {
            compileError(`Unexpected line outside of script block: ${line}`);
        }
    }

    return scripts;
}

/* ----------------------- Custom block utilities (new) -------------------- */

// Parse the custom block header list into a proccode + arg info
function parseCustomBlockHeader(headerLine) {
    const m = headerLine.match(/^block\s*\[(.*)\]\s*\{$/);
    if (!m) compileError("Malformed custom block header");

    const inner = m[1];
    const re = /(label|reporter|boolean)\s*:\s*"(.*?)"/g;
    let proccodeParts = [];
    let argNames = [];
    let argKinds = [];
    let match;
    while ((match = re.exec(inner)) !== null) {
        const kind = match[1];
        const text = match[2];
        if (kind === "label") {
            proccodeParts.push(text);
        } else if (kind === "reporter") {
            proccodeParts.push("%r");
            argNames.push(text);
            argKinds.push("reporter");
        } else if (kind === "boolean") {
            proccodeParts.push("%b");
            argNames.push(text);
            argKinds.push("boolean");
        }
    }
    if (!proccodeParts.length) compileError("Custom block header is empty");
    const proccode = proccodeParts.join(" ").replace(/\s+/g, " ").trim();
    const internalName = `__custom_${(++__customBlockCounter).toString(36)}`;
    return { internalName, proccode, argNames, argKinds };
}

function registerCustomBlockFromScriptHeader(headerLine, bodyLines) {
    const meta = parseCustomBlockHeader(headerLine);

    customBlocks[meta.proccode] = {
        proccode: meta.proccode,
        argNames: meta.argNames,
        argKinds: meta.argKinds,
        body: bodyLines.slice(),
        internalName: meta.internalName
    };

    // teach the compiler that this is “callable” by its proccode
    // (opcode is sentinel – we don't emit a real Scratch procedures_* here)
    blockData[meta.proccode] = {
        opcode: "__custom_macro__",
        type: "stack",
        inputs: meta.argNames.map((_, i) => `ARG${i}`),
        dropdown: null,
        dropdownInputs: null
    };

    return meta.proccode;
}

// Expand a macro-style custom block call inline
function expandAndCompileCustomCall(proccode, params, parent, nestingLevel) {
    const def = customBlocks[proccode];
    if (!def) compileError(`Unknown custom block '${proccode}'`);

    if (params.length !== def.argNames.length) {
        compileError(`Custom block '${proccode}' expects ${def.argNames.length} input(s), got ${params.length}`);
    }

    // Build textual replacements for $arg occurrences
    const subst = Object.create(null);
    for (let i = 0; i < def.argNames.length; i++) {
        const name = def.argNames[i];
        const term = params[i];

        function toSrc(t) {
            if (typeof t === "object") {
                const fn = t[0];
                const rest = t.slice(1).map(toSrc).join(", ");
                return `${fn}(${rest})`;
            }
            return String(t);
        }
        subst[name] = toSrc(term);
    }

    // Substitute $name in the custom body
    const expanded = def.body.map(line => {
        let out = line;
        for (const k of def.argNames) out = out.replaceAll(`$${k}`, subst[k]);
        return out;
    });

    // And compile those lines as if they were written here
    let state = { currentLine: 0, nestingList: [] };
    while (state.currentLine < expanded.length) {
        compileStatement(state, expanded);
    }
}

/* ---------------------------- Statement engine --------------------------- */

function compileStatement(state, codeLines) {
    let line = codeLines[state.currentLine++];
    lineNum = state.currentLine;
    line = line.trim();

    if (line.startsWith("//") || line == "") return;

    if (line == "}") {
        if (state.nestingList.length == 0) compileError("Unexpected '}'");
        let keys = Object.keys(blockList);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].next && blockList[key].nestingLevel == state.nestingList.length) {
                blockList[key].next = null; // don't prematurely end outer chain
                break;
            }
        }
        state.nestingList.pop();
        return;
    }

    if (line.replaceAll(" ", "") == "}else{") {
        let keys = Object.keys(blockList);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].next && blockList[key].nestingLevel == state.nestingList.length) {
                blockList[key].next = null;
                break;
            }
        }
        let found = false;
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].opcode == "control_if" && blockList[key].nestingLevel == state.nestingList.length - 1) {
                blockList[key].opcode = "control_if_else";
                blockList[key].inputs.SUBSTACK2 = [2, (blockID + 1).toString()];
                found = true;
                break;
            }
        }
        if (!found) compileError("could not find if");
        return;
    }

    if (line.startsWith("repeat") || line.startsWith("while") || line.startsWith("if (") || line.startsWith("if(")) {
        // Parse the condition/expression up to '{'
        let repeatCountExpression = parseBlock(line.slice(0, line.length - 2)); // trim trailing " {"
        let repeatID = blockID + 1;
        compileBlock(repeatCountExpression, blockID, state.nestingList.length);
        blockList[repeatID.toString()].inputs.SUBSTACK = [2, (blockID + 1).toString()];

        let nestingDepth = state.nestingList.length;
        state.nestingList.push(repeatID);
        while (state.nestingList.length > nestingDepth) {
            compileStatement(state, codeLines);
        }
        blockList[repeatID.toString()].next = (blockID + 1).toString();
    } else {
        // “ordinary” block
        let id = blockID + 1;
        compileBlock(parseBlock(line), blockID, state.nestingList.length);
        blockList[id.toString()].next = (blockID + 1).toString();
    }
}

/* -------------------------- Sprite compilation --------------------------- */

function clearVariablesAndLists(keepGlobal) {
    if (keepGlobal) {
        for (key of Object.keys(variables)) {
            if (!variables[key].global) delete variables[key];
        }
        for (key of Object.keys(lists)) {
            if (!lists[key].global) delete lists[key];
        }
    } else {
        variables = {};
        lists = {};
    }
}

function compileSprite(sprite) {
    spriteBeingCompiled = sprite;

    let codeLines = codeList[sprite].replaceAll("\r", "").split("\n");
    codeLines = handleSpecial(codeLines);

    // New: break up file by explicit script/custom blocks instead of blank lines
    let scripts = extractScriptBlocks(codeLines);

    blockY = 0;
    blockList = {};
    clearVariablesAndLists(true);
    lineNum = 0;

    for (let script of scripts) {
        firstBlockInScript = true;
        lineNum = script.startLine;

        let headerLine = script.header.trim();

        if (headerLine.startsWith("block ") && headerLine.endsWith("{")) {
            // register custom block definition – we don't compile its body now
            registerCustomBlockFromScriptHeader(headerLine, script.body);
            continue;
        } else if (headerLine.startsWith("script") && headerLine.endsWith("{")) {
            // “script { … }” is body-only; nothing to emit before the body
        } else if (headerLine.endsWith("() {")) {
            // hat block – emit it as the first block in the chain
            let hatBlockName = headerLine.slice(0, -4); // Remove "() {"
            let hatBlockExpression = parseBlock(hatBlockName + "()");
            compileBlock(hatBlockExpression, blockID, 0);
        }

        // body
        let state = { currentLine: 0, nestingList: [] };
        let bodyLines = script.body;
        while (state.currentLine < bodyLines.length) {
            compileStatement(state, bodyLines);
        }

        // terminate the current top-level chain
        let keys = Object.keys(blockList);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            if (blockList[key].next && blockList[key].nestingLevel == 0) {
                blockList[key].next = null;
                break;
            }
        }
        blockY += 90;
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
        costumes: getCostumes(sprite),
        sounds: getSounds(sprite),
        volume: 100,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: "left-right",
    };

    if (sprite == "stage") {
        (newSprite.tempo = 60), (newSprite.videoTransparency = 50), (newSprite.videoState = "on"), (newSprite.textToSpeechLanguage = null);
        newSprite.isStage = true;
        delete newSprite.x;
        delete newSprite.y;
    }
    return newSprite;
}

/* ------------------------------- Entry point ----------------------------- */

let spriteBeingCompiled;

async function compile() {
    let compiled;
    try {
        blockID = 0;
        broadcasts = {};
        clearVariablesAndLists();

        compiled = {
            targets: [],
            monitors: [],
            extensions: [],
            meta: {
                semver: "3.0.0",
                vm: "0.2.0",
                agent: "",
                platform: {
                    name: "TurboWarp",
                    url: "https://turbowarp.org/",
                },
            },
        };
        spriteBeingCompiled = null;
        for (let sprite of spriteList) {
            compiled.targets.push(compileSprite(sprite));
        }
        compiled.targets[0].broadcasts = getBroadcasts(); // stage holds broadcasts
    } catch (e) {
        if (!e.message.startsWith("CompileError")) {
            alert("An unexpected error was encountered while compiling — " + e.message);
        } else {
            alert(e.message);
            console.error(e);
        }
        return null;
    }

    let zip = new JSZip();
    zip.file("project.json", JSON.stringify(compiled, null, 4));
    for (let assetID of Object.keys(assets.list)) {
        if (isAssetUsed(assetID)) {
            zip.file(assetID, assets.list[assetID]);
        }
    }
    let blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
    });

    let a = await blob.arrayBuffer();
    window.output10 = a;
    return a;
}

async function run() {
    saveCurrentSpriteCode();
    let project = await compile();
    document.getElementById("preview").hidden = false;
    document.getElementById("sprite-container").style.marginTop = "0px";
    if (project) {
        await loadProject(project);
        startProject();
    }
}
