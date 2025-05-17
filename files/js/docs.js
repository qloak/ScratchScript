
async function load() {
    let progress = document.getElementById("progress")

    let r = await fetch("../files/data/blockData.json5")
    let t = await r.text()
    progress.value = 5
    sleep(0)
    let data = JSON5.parse(t)
    let r2 = await fetch("../files/data/blockImages.json5")
    let t2 = await r2.text()
    progress.value = 10
    sleep(0)
    let imageData = JSON5.parse(t2).data
    let keys = Object.keys(data)
    let table = document.getElementById("block-table")
    let b = document.createElement("tbody")
    
    let i = 0
    for (let key of keys) {
        let argStr = "("
        console.log(data[key])
        if (data[key].niceInputNames) {
            for (let arg of data[key].niceInputNames) {
                argStr += arg + ", "
            }
            argStr = argStr.slice(0, argStr.length - 2)
        }
        argStr += ")"
        let node = htmlToNode(`<tr><td>${((data[key].customDocs) ? data[key].customDocs: key + argStr)}</td><td><pre class="blocks">${imageData[key.toLowerCase()]}</pre></td></tr>`)
        b.appendChild(node)
        // b.innerHTML += node.outerHTML

        i += 1
        // console.log(5 + ((i / keys.length) * 100))
        if (Math.random() > 0.8) {
            progress.value = 10 + ((i / keys.length) * 90)
            await sleep(0)
        }
    }
    progress.value = 100
    setTimeout(function() {progress.hidden = true}, 150)

    table.appendChild(b)
    scratchblocks.renderMatching('pre.blocks', {
        style: 'scratch3',
        scale: 0.7
    })
    table.hidden = false
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.onload = load