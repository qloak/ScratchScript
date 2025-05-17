// Basic setup
let blockData;

// Fetch block data
fetch("files/data/blockImages.json5")
    .then((r) => r.text())
    .then(function (t) {
        window.blockImages = JSON5.parse(t).data;
    });

// Fetch block images — stored as scratchblocks to be rendered
fetch("files/data/blockData.json5")
    .then((r) => r.text())
    .then(function (t) {
        getCompletions(JSON5.parse(t));
    });

function getCompletions(data) {
    // for CodeMirror
    blockData = data;

    let completions = [];
    for (let [key, value] of Object.entries(blockData)) {
        if (value.shouldInclude == false) {
            continue;
        }
        completions.push({ label: key, type: "function", info: " " });
        if (key == "whenGreenFlagClicked") {
            completions[completions.length - 1].boost = 999;
        }
    }
    window.codeCompletions = completions;
}

window.addEventListener("load", setup);

function setup() {
    // enableButtons()
    setTimeout(function () {
        document.querySelector("#editor-loading-spinner").style.display = "none";
        document.querySelector("#editor").hidden = false;
    }, 0);
    setTimeout(checkStart, 100);
}

async function checkStart() {
    if (window.codemirror) {
        await loadProjectFromFile(await (await fetch("files/projects/Default.ScratchScript")).arrayBuffer());
        run();
    } else {
        setTimeout(checkStart, 20);
    }
}

// compiler code used to go here

async function download() {
    saveCurrentSpriteCode();
    let project = await compile();
    if (project) {
        const url = URL.createObjectURL(
            new Blob([project], {
                type: "application/x.scratch.sb3",
            })
        );
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "project.sb3";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } else {
        alert("Failed to download project");
    }
}

async function saveCode() {
    saveCurrentSpriteCode();
    // let code = codemirror.state.doc.toString();
    // const url = URL.createObjectURL(
    //     new Blob([code], {
    //         type: "text/plain",
    //     })
    // );
    const url = URL.createObjectURL(
        new Blob([await saveEditorStateToFile()], {
            type: "application/zip",
        })
    );
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "project.ScratchScript";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

async function loadCode() {
    let el = document.getElementById("loadcodeinput");
    loadProjectFromFile(el.files[0]);
    el.value = "";
}
