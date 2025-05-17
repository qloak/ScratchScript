const scaffolding = new Scaffolding.Scaffolding();

scaffolding.width = 480;
scaffolding.height = 360;
scaffolding.resizeMode = 'preserve-ratio'; // or 'dynamic-resize' or 'stretch'
scaffolding.editableLists = false;
scaffolding.shouldConnectPeripherals = true;
scaffolding.usePackagedRuntime = false;
scaffolding.setAccentColor("#4c97ff")

scaffolding.setup();
scaffolding.appendTo(document.getElementById('project'));

setInterval(countClones, 500)

const storage = scaffolding.storage;
storage.addWebStore(
    [storage.AssetType.ImageVector, storage.AssetType.ImageBitmap, storage.AssetType.Sound],
    (asset) => `https://assets.scratch.mit.edu/internalapi/asset/${asset.assetId}.${asset.dataFormat}/get/`,
);

function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
} 

async function imageToDataURL(image) {
    let img = image
    let bitmap = await createImageBitmap(img);
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    return canvas.toDataURL("image/png");
};

async function loadProject(json) {
    try {
        document.querySelector("#loading").style.display = ""
        document.getElementById("project").hidden = true
        scaffolding.vm.runtime.on("ASSET_PROGRESS", updateProgress)
        await scaffolding.loadProject(json);

        scaffolding.vm.runtime.renderer.setUseHighQualityRender(true)
        startProject()
        showControlBar()
    }
    catch (e) {
        document.querySelector("#loading .loading-spinner").style.display = "none"
        document.getElementById("loading-progress").style.display = "none"
        document.getElementById("loading-text").innerText = e
    }
};

function startProject() {
    document.getElementById("loading").style.display = "none"
    document.getElementById("project").hidden = false
    scaffolding.greenFlag();
    scaffolding.relayout();
}

function showControlBar() {
    // let rootEl = document.getElementById("project")
    // let greenFlag = document.createElement("img")
    // greenFlag.src = "data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNi42MyAxNy41Ij48ZGVmcz48c3R5bGU+LmNscy0xLC5jbHMtMntmaWxsOiM0Y2JmNTY7c3Ryb2tlOiM0NTk5M2Q7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30uY2xzLTJ7c3Ryb2tlLXdpZHRoOjEuNXB4O308L3N0eWxlPjwvZGVmcz48dGl0bGU+aWNvbi0tZ3JlZW4tZmxhZzwvdGl0bGU+PHBhdGggY2xhc3M9ImNscy0xIiBkPSJNLjc1LDJBNi40NCw2LjQ0LDAsMCwxLDguNDQsMmgwYTYuNDQsNi40NCwwLDAsMCw3LjY5LDBWMTIuNGE2LjQ0LDYuNDQsMCwwLDEtNy42OSwwaDBhNi40NCw2LjQ0LDAsMCwwLTcuNjksMCIvPjxsaW5lIGNsYXNzPSJjbHMtMiIgeDE9IjAuNzUiIHkxPSIxNi43NSIgeDI9IjAuNzUiIHkyPSIwLjc1Ii8+PC9zdmc+"
    // greenFlag.classList = "control-button start"
    // greenFlag.setAttribute("onclick", "scaffolding.greenFlag()")

    // let stopButton = document.createElement("img")
    // stopButton.src = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNCAxNCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTQgMTQ7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRUM1OTU5O3N0cm9rZTojQjg0ODQ4O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoxMDt9Cjwvc3R5bGU+Cjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iNC4zLDAuNSA5LjcsMC41IDEzLjUsNC4zIDEzLjUsOS43IDkuNywxMy41IDQuMywxMy41IDAuNSw5LjcgMC41LDQuMyAiLz4KPC9zdmc+Cg=="
    // stopButton.classList = "control-button stop"
    // stopButton.setAttribute("onclick", "scaffolding.stopAll()")

    // controlBar = document.createElement("div")
    // controlBar.appendChild(greenFlag)
    // controlBar.appendChild(stopButton)
    // rootEl.insertBefore(controlBar, document.getElementsByClassName("sc-root")[0])
    document.getElementById("project-control-bar").hidden = false
}

// loadProject('60917032'); // appel
// loadProject("908626779") // minecraft
// loadProject("322341152") // terraria
// loadProject("753049043") // mario maker
// loadProject("1000000000")
// loadProject(1234567) // unshared
// loadProject(1234567890) //non-existant
// loadProject(123456) // project
// loadProject(1064654240) // inventory test
// loadProject(875973129) // scratch emulator

function updateProgress(loaded, total) {
    if (loaded > 0) {
        // console.log(`${loaded}/${total}`)
        document.getElementById("loading-progress").innerText = `${loaded}/${total}`
    }
}

function countClones() {
    let counter = document.getElementById("clone-counter")
    let clones = scaffolding.vm.runtime._cloneCounter
    if (clones > 0) {
        counter.hidden = false
        counter.innerHTML = `&ThickSpace;Clones: ${clones}`
    } else {
        counter.hidden = true
    }
}