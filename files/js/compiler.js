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
        if (parenLevel == 0 && char == "," && !inString) {
            output.push(str.slice(start, i).trim());
            start = i + 1;
        }
        i += 1;
    }
    output.push(str.slice(start, i).trim());

    // console.log(output);
    return output; // Returns a list
}

function parseBlock(str) {
    // Parse block recursively making a nested list of lists
    // Returns a list of terms
    // A term is either a literal value or a function name
    // A term is an Object
    str = str.trim();
    if (str.startsWith('"')) {
        // String
        return str.slice(1, str.length - 1);
    }
    if (!isNaN(parseFloat(str))) {
    return parseFloat(str);
    }
    
    if (str === "true" || str === "false") {
        return str;
    }
    
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)) {
        return str;
    }
    
    if (!str.includes("(")) {
        compileError("Missing '('");
    }

            if (!str.includes(")")) {
                compileError("Missing ')'");
            }

            let functionName = str.slice(0, str.indexOf("(")).trim();
            let paramsString = str.slice(str.indexOf("("));
            let paramsStringsArray = getParamsArray(paramsString);
            let paramTermsArray = paramsStringsArray.map((s) => parseBlock(s));

            return [functionName].concat(paramTermsArray);
        } else {
            if (str == "true" || str == "false") {
                return str;
            } else {
                if (str.startsWith("#")) {
                    return listStartThing + str;
                } else {
                    return variableStartThing + str;
                }
            }
        }
        // for (let paramsStr of paramsStringsArray) {

        // }
    }
}

function getVariables() {
    let v = {};
    for (let key of Object.keys(variables)) {
        if (spriteBeingCompiled != "stage") {
            if (!variables[key].global) {
                v[variables[key].id] = [key, 0];
            }
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
            if (!lists[key].global) {
                v[lists[key].id] = [key, []];
            }
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
    let example = {
        name: "costume1",
        bitmapResolution: 1,
        dataFormat: "svg",
        assetId: "bcf454acf82e4504149f7ffe07081dbc",
        md5ext: "bcf454acf82e4504149f7ffe07081dbc.svg",
        rotationCenterX: 48,
        rotationCenterY: 50,
    };
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
    let example = {
        name: "Meow",
        assetId: "83c36d806dc92327b9e7049a565c6bff",
        dataFormat: "wav",
        format: "",
        rate: 48000,
        sampleCount: 40682,
        md5ext: "83c36d806dc92327b9e7049a565c6bff.wav",
    };
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

const input1 = '"3"';
const output1 = "3";
const input2 = "3.14159";
const output2 = 3.14159;
const input3 = "pickRandom(1, 10)";
const output3 = ["pickRandom", 1, 10];
const input4 = 'sayForSecs(pickRandom(1, pickRandom(5, "10")), 2.5)';

const variableStartThing = "$`!jsf☠d_Why are you looking here_89ISf[$!☠$~$";
const listStartThing = "#`!j☠sf_Why are you looking here?_d7S&pSf]]@$!☠#~#";

let blockID;
let blockY;
let firstBlockInScript;
let blockList;
let variables;
let lists;
let broadcasts;
let lineNum;
let customBlocks;
let nextParentOverride;
let startedFirstScript;

function compileBlock(code, parent, nestingLevel) {
    // console.log("linestr", lineString)
    // if (lineString.startsWith("//") || lineString == "") {
    //     return;
    // }
    blockID += 1;
    let myID = blockID;
    // let parsedCode = parse(lineString);
    let parsedCode = code;

    let block = {};

    // if (parsedCode[0].startsWith("$")) {
    //     console.log("variable get")
    //     let varName = parsedCode[0].slice(1)
    //     if (varName == "") {
    //         compileError("Variable name is blank")
    //     }
    //     block = [12, varName, variables[varName].id]
    // } else {

    let funcName = parsedCode.shift();
    let params = parsedCode;
    let meta = customBlocks && customBlocks[funcName];

    if (!funcName) {
        compileError("Function name is undefined");
    }
    if (!blockData[funcName] && !meta) {
        compileError(`There is no function called '${funcName}'`);
    }

    block.next = null;
    block.shadow = false;
    block.fields = {};
    block.inputs = {};
    block.topLevel = false;
    block.nestingLevel = nestingLevel;
    block.opcode = meta ? "procedures_call" : blockData[funcName].opcode;

    if (nextParentOverride) {
        block.parent = nextParentOverride.toString();
        block.topLevel = false;
        if (!blockList[nextParentOverride.toString()].next) {
            blockList[nextParentOverride.toString()].next = myID.toString();
        }
        nextParentOverride = null;
        firstBlockInScript = false;
    } else if (firstBlockInScript) {
        block.x = 0;
        block.y = blockY;
        block.parent = null;
        block.topLevel = true;
        firstBlockInScript = false;
    } else {
        block.parent = parent.toString();
    }

    let typeInfo = blockData[funcName] || { type: "stack" };
    if (typeInfo.type == "stack") {
        blockY += 70;
    }

    // let doNormal = false;
    // dropdownBlock: if (blockData[funcName].dropdown == "block") {
    //     let dropBlockID = (blockID + 1).toString();
    //     let dropBlock = {
    //         parent: myID.toString(),
    //         next: null,
    //         inputs: {},
    //         fields: {},
    //         shadow: true,
    //     };

    //     for (let [i, param] of params.entries()) {
    //         let item = blockData[funcName].dropdownOpcode[i];
    //         if (item != null) {
    //             console.log("dropblock", item, param);
    //             if (typeof param == "object") {
    //                 console.log("canceling...", param);
    //                 block.inputs = {};
    //                 doNormal = true;
    //                 break dropdownBlock;
    //             }
    //             dropBlock.opcode = item;
    //             dropBlock.fields[blockData[funcName].inputs[i]] = [param, null];
    //             block.inputs[blockData[funcName].inputs[i]] = [1, dropBlockID];
    //         } else {
    //             block.inputs[blockData[funcName].inputs[i]] = [1, [10, param]];
    //         }
    //     }

    //     console.log(dropBlock);
    //     blockList[dropBlockID] = dropBlock;
    //     blockID += 1;
    // } else {
    //     doNormal = true;
    // }
    let doNormal = true;

    if (doNormal) {
        for (let [i, param] of params.entries()) {
            if (typeof param == "object") {
                // Another block
                block.inputs[blockData[funcName].inputs[i]] = [3, (blockID + 1).toString()]; // If the input is a block
                // if (block.type != "boolean" && !funcName.startsWith("if")) {
                //     block.inputs[blockData[funcName].inputs[i]][2] = [10, ""];
                // }
                compileBlock(param, myID);
            } else {
                dropBlockIf: if (blockData[funcName].dropdown == "block") {
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
                            doNormal = true;
                            break dropBlockIf;
                        }
                        dropBlock.opcode = item;
                        dropBlock.fields[blockData[funcName].inputs[i]] = [param, null];
                        block.inputs[blockData[funcName].inputs[i]] = [1, dropBlockID];
                        blockList[dropBlockID] = dropBlock;
                        blockID += 1;
                        continue;
                    }
                }

                if (blockData[funcName].dropdownInputs) {
                    // block contains a square dropdown
                    if (blockData[funcName].dropdownInputs[i] != null) {
                        // only replace input if it is a dropdown
                        block.fields[blockData[funcName].inputs[i]] = [param, null]; // second param has to be null for some reason

                        // variables
                        // if (funcName == "setVar" || funcName == "changeVar") {
                        if (blockData[funcName].category) {
                            if (blockData[funcName].category == "variable") {
                                let varID;
                                if (variables[param]) {
                                    varID = variables[param].id;
                                } else {
                                    varID = Math.round(Math.random() * 1e15).toString();
                                    variables[param] = {};
                                    variables[param].id = varID;
                                    variables[param].value = 0;
                                    if (spriteBeingCompiled == "stage") {
                                        variables[param].global = true;
                                    }
                                }
                                block.fields[blockData[funcName].inputs[i]][1] = varID;
                            }
                            // }

                            // lists
                            // if (blockData[funcName].category) {
                            if (blockData[funcName].category == "list") {
                                let listID;
                                if (lists[param]) {
                                    listID = lists[param].id;
                                } else {
                                    listID = Math.round(Math.random() * 1e15).toString();
                                    lists[param] = {};
                                    lists[param].id = listID;
                                    lists[param].value = [];
                                    if (spriteBeingCompiled == "stage") {
                                        lists[param].global = true;
                                    }
                                }
                                block.fields[blockData[funcName].inputs[i]][1] = listID;
                            }
                        }

                        // broadcast received block - only one with a dropdown
                        if (blockData[funcName].opcode == "event_whenbroadcastreceived") {
                            let brID;
                            if (broadcasts[param]) {
                                brID = broadcasts[param].id;
                            } else {
                                brID = Math.round(Math.random() * 1e15).toString();
                                broadcasts[param] = {};
                                broadcasts[param].id = brID;
                            }
                            block.fields[blockData[funcName].inputs[i]][1] = brID;
                        }

                        continue;
                    }
                }
                if (param.toString().startsWith(variableStartThing)) {
                    // variable
                    let varName = param.toString().slice(variableStartThing.length + 1);
                    if (varName == "") {
                        compileError("Variable name is blank");
                    }
                    if (!variables[varName]) {
                        compileError(`There is no variable named '${varName}'`);
                    }
                    block.inputs[blockData[funcName].inputs[i]] = [3, [12, varName, variables[varName].id]];
                } else {
                    if (param.toString().startsWith(listStartThing)) {
                        let listName = param.toString().slice(listStartThing.length + 1);
                        if (listName == "") {
                            compileError("List name is blank");
                        }
                        if (!lists[listName]) {
                            compileError(`There is no list named '${listName}'`);
                        }
                        block.inputs[blockData[funcName].inputs[i]] = [3, [13, listName, lists[listName].id]];
                    } else {
                        if (funcName.startsWith("broadcast")) {
                            let brID;
                            if (broadcasts[param]) {
                                brID = broadcasts[param].id;
                            } else {
                                brID = Math.round(Math.random() * 1e15).toString();
                                broadcasts[param] = {};
                                broadcasts[param].id = brID;
                            }
                            block.inputs[blockData[funcName].inputs[i]] = [1, [11, param.toString(), brID]];
                        } else {
                            block.inputs[blockData[funcName].inputs[i]] = [1, [10, param]]; // regular string or number
                        }
                    }
                }

                if (funcName.toLowerCase().includes("color")) {
                    // special case color inputs
                    if (param.toString().startsWith("#")) {
                        block.inputs[blockData[funcName].inputs[i]][1][0] = 9; // type 9 is color
                    }
                }
            }
        }
        if (params && blockData[funcName].inputs) {
            let got = params.length;
            let want = blockData[funcName].inputs.length;
            if (got != want) {
                compileError(`Got ${got} input${got == 1 ? "" : "s"}, expected ${want} input${want == 1 ? "" : "s"}`);
            }
        }
    }
    if (meta) {
        block.mutation = {
            proccode: meta.proccode,
            argumentids: JSON.stringify(meta.argIds),
            warp: "false",
        };
    }
    blockList[myID.toString()] = block;
}

function parseCustomBlockHeader(s) {
    let parts = tokenizeHeaderKVs(s);
    let tokens = [];
    let argNames = [];
    for (let { key, val } of parts) {
        if (key === "label") tokens.push({ kind: "label", text: val });
        else if (key === "reporter") {
            tokens.push({ kind: "rep", name: val });
            argNames.push(val);
        } else if (key === "boolean") {
            tokens.push({ kind: "bool", name: val });
            argNames.push(val);
        } else {
            compileError(`Unknown custom block part '${key}'`);
        }
    }
    if (!tokens.length) compileError("Custom block header is empty");
    if (tokens[0].kind !== "label") compileError("Custom block must start with a label");

    let codePieces = [], callPieces = [];
    tokens.forEach(t => {
        if (t.kind === "label") {
            let text = t.text.trim();
            codePieces.push(text);
            callPieces.push(text);
        }
        if (t.kind === "rep") {
            codePieces.push("%s");
            callPieces.push(t.name.trim());
        }
        if (t.kind === "bool") {
            codePieces.push("%b");
            callPieces.push(t.name.trim());
        }
    });
    let proccode = codePieces.join(" ").replace(/\s+/g, " ").trim();
    let callName = callPieces.join("_").replace(/\s+/g, "_");

    let argIds = argNames.map(() => Math.round(Math.random() * 1e15).toString());
    let protoId = Math.round(Math.random() * 1e15).toString();
    return { proccode, argNames, argIds, protoId, callName };
}

function tokenizeHeaderKVs(s) {
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
        let val = "", inEsc = false;
        for (; i < s.length; i++) {
            let c = s[i];
            if (inEsc) {
                val += c;
                inEsc = false;
                continue;
            }
            if (c === "\\") {
                inEsc = true;
                continue;
            }
            if (c === '"') break;
            val += c;
        }
        if (i >= s.length || s[i] !== '"') compileError("Unterminated string in custom block header");
        i++;
        out.push({ key, val });
    }
    return out;
}

function emitProcedureDefinition(meta, nestingLevel) {
    let defId = (blockID + 1).toString();
    let prototypeId = meta.protoId;

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
            warp: "false",
        },
    };

    let def = {
        parent: null,
        next: null,
        inputs: { CUSTOM_BLOCK: [1, prototypeId] },
        fields: {},
        shadow: false,
        opcode: "procedures_definition",
        topLevel: true,
        x: 0,
        y: blockY,
        nestingLevel,
    };

    blockList[defId] = def;
    blockList[prototypeId] = proto;
    blockID += 2;
    blockY += 70;

    customBlocks[meta.callName] = meta;
    blockData[meta.callName] = { opcode: "procedures_call", inputs: meta.argNames, type: "stack" };
    return defId;
}

const nestingType = {
    REPEAT: "repeat",
    IFTHEN: "ifthen",
    IFTHENELSE: "ifthenelse",
};

function compileStatement(state, codeLines) {
    let line = codeLines[state.currentLine++];
    lineNum = state.currentLine;
    line = line.trim();
    if (line === "" || line.startsWith("//")) {
        return;
    }
    if (line === "script{" || line === "script {") {
        if (startedFirstScript) {
            blockY += 90;
        } else {
            startedFirstScript = true;
        }
        firstBlockInScript = true;
        state.inScript = true;
        return;
    }
    if (line.startsWith("block [") && (line.endsWith("{") || line.endsWith("{ "))) {
        let inside = line.slice(line.indexOf("[") + 1, line.lastIndexOf("]"));
        let meta = parseCustomBlockHeader(inside);
        let defId = emitProcedureDefinition(meta, state.nestingList.length);
        nextParentOverride = defId;
        state.nestingList.push(defId);
        return;
    }
    if (line == "}") {
        if (state.nestingList.length > 0) {
            let keys = Object.keys(blockList);
            for (let i = keys.length - 1; i >= 0; i--) {
                let key = keys[i];
                if (blockList[key].next && blockList[key].nestingLevel == state.nestingList.length) {
                    blockList[key].next = null;
                    break;
                }
            }
            state.nestingList.pop();
            return;
        }
        if (state.inScript) {
            let keys = Object.keys(blockList);
            for (let i = keys.length - 1; i >= 0; i--) {
                let key = keys[i];
                if (blockList[key].next && blockList[key].nestingLevel == 0) {
                    blockList[key].next = null;
                    break;
                }
            }
            state.inScript = false;
            return;
        }
        compileError("Unexpected '}'");
    }
    if (!state.inScript && state.nestingList.length === 0) {
    compileError("Statement outside of script or custom block");
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
        if (!found) {
            compileError("could not find if");
        }
        return;
    }
    if (line.startsWith("repeat") || line.startsWith("while") || line.startsWith("if (") || line.startsWith("if(")) {
        let repeatCountExpression = parseBlock(line.slice(0, line.length - 2));
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
        let id = blockID + 1;
        compileBlock(parseBlock(line), blockID, state.nestingList.length);
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

    let codeLines = codeList[sprite].replaceAll("\r", "").split("\n");
    codeLines = handleSpecial(codeLines); // Handles forever loops
    let currentLine = 0;
    blockY = 0;
    firstBlockInScript = true;
    startedFirstScript = false;
    blockList = {};
    clearVariablesAndLists(true);
    lineNum = 0;
    let state = { currentLine: currentLine, nestingList: [], inScript: false };

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
        costumes: getCostumes(sprite),
        sounds: getSounds(sprite) /*[
            {
            "name": "Meow",
            "assetId": "83c36d806dc92327b9e7049a565c6bff",
            "dataFormat": "wav",
            "format": "",
            "rate": 48000,
            "sampleCount": 40682,
            "md5ext": "83c36d806dc92327b9e7049a565c6bff.wav"
            }
        ],*/,
        volume: 100,
        // "layerOrder": 2,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: "left-right",
    };

    if (sprite == "stage") {
        // newSprite.broadcasts = getBroadcasts()
        (newSprite.tempo = 60), (newSprite.videoTransparency = 50), (newSprite.videoState = "on"), (newSprite.textToSpeechLanguage = null);
        newSprite.isStage = true;
        // newSprite.layerOrder = 0;
        // delete newSprite.layerOrder
        delete newSprite.x;
        delete newSprite.y;
    }
    return newSprite;
}

let spriteBeingCompiled;

async function compile() {
    let compiled;
    try {
        // let codeLines = document.querySelector("#editor").value.replaceAll("\r", "").split("\n");
        // let codeLines = codemirror.state.doc.toString().replaceAll("\r", "").split("\n");
        // codeLines = handleSpecial(codeLines); // Handles forever loops
        // let currentLine = 0;
        blockID = 0;
        broadcasts = {};
        clearVariablesAndLists();
        customBlocks = {};
        nextParentOverride = null;
        startedFirstScript = false;

        // while (state.currentLine < codeLines.length) {
        //     compileStatement(state, codeLines);
        // }
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
        compiled.targets[0].broadcasts = getBroadcasts();
    } catch (e) {
        if (!e.message.startsWith("CompileError")) {
            alert("An unexpected error was encountered while compiling — " + e.message);
        } else {
            alert(e.message);
            console.error(e);
        }
        return null;
    }
    // for (let line of codeLines) {
    //     line = line.trim()
    //     if (line.startsWith("//") || line == "") {
    //         continue
    //     }
    //     let id = blockID + 1; // The ID of the next block to be compiled
    //     compileBlock(parseBlock(line), blockID); // Changes block ID by however many blocks were compiled
    //     blockList[id.toString()].next = (blockID + 1).toString();
    // }
    // console.log(blockList);
    // console.log(variables);

    // let json = `{
    //     "targets": [
    //         {
    //         "isStage": true,
    //         "name": "Stage",
    //         "variables": {},
    //         "lists": {},
    //         "broadcasts": ${JSON.stringify(getBroadcasts(), null, 4)},
    //         "blocks": {},
    //         "comments": {},
    //         "currentCostume": 0,
    //         "costumes": [
    //             {
    //             "name": "backdrop1",
    //             "dataFormat": "svg",
    //             "assetId": "cd21514d0531fdffb22204e0ec5ed84a",
    //             "md5ext": "cd21514d0531fdffb22204e0ec5ed84a.svg",
    //             "rotationCenterX": 240,
    //             "rotationCenterY": 180
    //             }
    //         ],
    //         "sounds": [],
    //         "volume": 100,
    //         "layerOrder": 0,
    //         "tempo": 60,
    //         "videoTransparency": 50,
    //         "videoState": "on",
    //         "textToSpeechLanguage": null
    //         },
    //         {
    //         "isStage": false,
    //         "name": "Sprite1",
    //         "variables": ${JSON.stringify(getVariables(), null, 4)},
    //         "lists": ${JSON.stringify(getLists(), null, 4)},
    //         "broadcasts": {},
    //         "blocks": ${JSON.stringify(blockList, null, 4)},
    //         "comments": {},
    //         "currentCostume": 0,
    //         "costumes": ${JSON.stringify(getCostumes(), null, 4)},
    //         "sounds": [
    //             {
    //             "name": "Meow",
    //             "assetId": "83c36d806dc92327b9e7049a565c6bff",
    //             "dataFormat": "wav",
    //             "format": "",
    //             "rate": 48000,
    //             "sampleCount": 40682,
    //             "md5ext": "83c36d806dc92327b9e7049a565c6bff.wav"
    //             }
    //         ],
    //         "volume": 100,
    //         "layerOrder": 2,
    //         "visible": true,
    //         "x": 0,
    //         "y": 0,
    //         "size": 100,
    //         "direction": 90,
    //         "draggable": false,
    //         "rotationStyle": "all around"
    //         }
    //     ],
    //     "monitors": [],
    //     "extensions": [],
    //     "meta": {
    //         "semver": "3.0.0",
    //         "vm": "0.2.0",
    //         "agent": "",
    //         "platform": {
    //             "name": "TurboWarp",
    //             "url": "https://turbowarp.org/"
    //         }
    //     }
    // }`;
    // console.log(json)
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
        compressionOptions: {
            level: 9,
        },
    });

    console.time("arraybuffer");
    let a = await blob.arrayBuffer();
    console.timeEnd("arraybuffer");
    // a = blob
    window.output10 = a;
    return a;
    // saveAs(blob, "hello.zip");
    // return json;
}

async function run() {
    saveCurrentSpriteCode();
    let project = await compile();
    // let r = await fetch("https://tmpfiles.org/api/v1/upload", {
    //     method: "POST",
    //     body: JSON.stringify({file: "test"})
    // })
    // document.getElementById("preview").src = "";

    // const form = new FormData();
    // form.append("file", new File([project], "CoolTestProject.sb3"));

    // let r = await fetch("https://tmpfiles.org/api/v1/upload", {
    //     method: "POST",
    //     body: form,
    // });

    // let response = await r.json();
    // if (response.data.url) {
    //     let u = new URL(response.data.url);
    //     let url = u.origin + "/dl" + u.pathname;
    //     console.log(url);
    //     document.getElementById("preview").src = `https://turbowarp.org/embed?project_url=${encodeURIComponent(`https://corsproxy.josueart40.workers.dev/?${url}`)}&autoplay&settings-button&addons=pause,remove-curved-stage-border,clones`;
    // } else {
    //     console.log(response);
    // }
    document.getElementById("preview").hidden = false;
    document.getElementById("sprite-container").style.marginTop = "0px";
    if (project) {
        await loadProject(project);
        startProject();
    }
}
