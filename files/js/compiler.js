function handleSpecial(lines) {
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
    return output;
}

function parseBlock(str) {
    str = str.trim();
    if (str.startsWith('"')) {
        return str.slice(1, str.length - 1);
    }
    if (!isNaN(parseFloat(str))) {
        return parseFloat(str);
    }
    if (isNaN(parseFloat(str)) && !str.startsWith('"')) {
        if (!(str.startsWith("$") || str.startsWith("#") || str == "true" || str == "false")) {
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
let spriteBeingCompiled;

function compileBlock(code, parent, nestingLevel) {
    blockID += 1;
    let myID = blockID;
    let parsedCode = code;

    let block = {};

    let funcName = parsedCode.shift();
    let params = parsedCode;

    if (!funcName) {
        compileError("Function name is undefined");
    }
    if (!blockData[funcName]) {
        compileError(`There is no function called '${funcName}'`);
    }

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
        blockY += 70;
    }

    let doNormal = true;

    if (doNormal) {
        for (let [i, param] of params.entries()) {
            if (typeof param == "object") {
                block.inputs[blockData[funcName].inputs[i]] = [3, (blockID + 1).toString()];
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
                    if (blockData[funcName].dropdownInputs[i] != null) {
                        block.fields[blockData[funcName].inputs[i]] = [param, null];

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
                            block.inputs[blockData[funcName].inputs[i]] = [1, [10, param]];
                        }
                    }
                }

                if (funcName.toLowerCase().includes("color")) {
                    if (param.toString().startsWith("#")) {
                        block.inputs[blockData[funcName].inputs[i]][1][0] = 9;
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

    blockList[myID.toString()] = block;
}

function endCurrentScript(nestingLevel = 0) {
    let keys = Object.keys(blockList);
    for (let i = keys.length - 1; i >= 0; i--) {
        let key = keys[i];
        if (blockList[key].next && blockList[key].nestingLevel == nestingLevel) {
            blockList[key].next = null;
            break;
        }
    }
}

function isLineHatBlock(line) {
    const hatBlocks = [
        'whenGreenFlag()',
        'whenKeyPressed(',
        'whenClicked()',
        'whenBroadcastReceived(',
        'whenBackdropSwitches(',
        'whenGreaterThan(',
        'whenIReceive('
    ];
    return hatBlocks.some(hat => line.startsWith(hat));
}

function parseScriptBlock(initialLine, state, codeLines) {
    // More robust parsing that handles different script formats
    const scriptMatch = initialLine.match(/^script\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]*)\))?\s*\{?$/);
    if (!scriptMatch) {
        compileError("Invalid script declaration. Use: script name { or script name (x,y) {");
    }
    
    const scriptName = scriptMatch[1];
    const positionArgs = scriptMatch[2] ? scriptMatch[2].split(',').map(arg => arg.trim()) : [];
    
    // Check if we already have the opening brace or need to get it from next line
    let hasOpeningBrace = initialLine.includes('{');
    let braceDepth = hasOpeningBrace ? 1 : 0;
    
    // Save current state
    const savedState = {
        blockList: {...blockList},
        blockID: blockID,
        blockY: blockY,
        firstBlockInScript: firstBlockInScript
    };
    
    try {
        // Initialize new script environment
        blockList = {};
        firstBlockInScript = true;
        
        // Set position if specified
        if (positionArgs.length === 2) {
            const x = parseInt(positionArgs[0]);
            const y = parseInt(positionArgs[1]);
            if (!isNaN(x) && !isNaN(y)) {
                blockY = y;
            } else {
                blockY += 90;
            }
        } else {
            blockY += 90;
        }
        
        // Parse script body
        const scriptLines = [];
        let lineNumberOffset = state.currentLine;
        
        if (!hasOpeningBrace) {
            // Get opening brace from next line
            let nextLine = codeLines[state.currentLine++];
            lineNum = state.currentLine;
            if (nextLine.trim() !== '{') {
                compileError("Expected '{' after script declaration");
            }
            braceDepth = 1;
        }
        
        while (state.currentLine < codeLines.length && braceDepth > 0) {
            let line = codeLines[state.currentLine];
            const trimmedLine = line.trim();
            
            if (trimmedLine === "{") {
                braceDepth++;
            } else if (trimmedLine === "}") {
                braceDepth--;
                if (braceDepth === 0) {
                    state.currentLine++;
                    break;
                }
            }
            
            if (braceDepth > 0) {
                scriptLines.push(line);
            }
            state.currentLine++;
        }
        
        if (braceDepth > 0) {
            compileError("Unclosed script block");
        }
        
        // Compile script body
        const scriptState = {
            currentLine: 0,
            nestingList: [],
            consecutiveBlankLines: 0
        };
        
        while (scriptState.currentLine < scriptLines.length) {
            const originalLineNum = lineNum;
            lineNum = lineNumberOffset + scriptState.currentLine;
            compileStatement(scriptState, scriptLines);
            lineNum = originalLineNum;
        }
        
        // Ensure proper script termination
        endCurrentScript();
        
        // Merge back into main block list
        Object.assign(savedState.blockList, blockList);
        
        console.log(`Successfully compiled script: ${scriptName}`);
        
    } catch (error) {
        // Restore state on error
        blockList = savedState.blockList;
        blockID = savedState.blockID;
        blockY = savedState.blockY;
        firstBlockInScript = savedState.firstBlockInScript;
        throw error;
    } finally {
        // Restore state
        blockList = savedState.blockList;
        blockID = savedState.blockID;
        blockY = savedState.blockY;
        firstBlockInScript = savedState.firstBlockInScript;
    }
}

function compileStatement(state, codeLines) {
    let line = codeLines[state.currentLine++];
    lineNum = state.currentLine;
    line = line.trim();
    
    // Skip empty lines and comments
    if (line === "" || line.startsWith("//")) {
        return;
    }
    
    console.log("line", line);
    
    // Handle script blocks - MUST check this before regular parsing
    if (line.startsWith("script")) {
        parseScriptBlock(line, state, codeLines);
        return;
    }
    
    // Check if this is a hat block starting a new script
    if (isLineHatBlock(line) && !firstBlockInScript) {
        endCurrentScript();
        firstBlockInScript = true;
        blockY += 90;
    }
    
    if (line == "}") {
        if (state.nestingList.length == 0) {
            compileError("Unexpected '}'");
        }
        endCurrentScript(state.nestingList.length);
        state.nestingList.pop();
        return;
    }
    
    if (line.replaceAll(" ", "") == "}else{") {
        endCurrentScript(state.nestingList.length);
        
        let keys = Object.keys(blockList);
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
        console.log("found repeat/if!");
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
    
    firstBlockInScript = false;
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
    codeLines = handleSpecial(codeLines);
    let currentLine = 0;
    blockY = 0;
    firstBlockInScript = true;
    blockList = {};
    clearVariablesAndLists(true);
    lineNum = 0;
    let state = { 
        currentLine: currentLine, 
        nestingList: [],
        consecutiveBlankLines: 0
    };

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
        newSprite.tempo = 60;
        newSprite.videoTransparency = 50;
        newSprite.videoState = "on";
        newSprite.textToSpeechLanguage = null;
        newSprite.isStage = true;
        delete newSprite.x;
        delete newSprite.y;
    }
    return newSprite;
}

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

    return await blob.arrayBuffer();
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
