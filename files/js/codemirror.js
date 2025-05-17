import {basicSetup, EditorView} from "./CodeMirror/codemirror.js"//"https://codemirror.net/try/mods/codemirror.js"
import {autocompletion} from "./CodeMirror/@codemirror-autocomplete.js"//"https://codemirror.net/try/mods/@codemirror-autocomplete.js"
import {keymap} from "./CodeMirror/@codemirror-view.js"//"https://codemirror.net/try/mods/@codemirror-view.js";
import {acceptCompletion} from "./CodeMirror/@codemirror-autocomplete.js"//"https://codemirror.net/try/mods/@codemirror-autocomplete.js"
import {indentWithTab} from "./CodeMirror/@codemirror-commands.js"
import {indentUnit} from "./CodeMirror/@codemirror-language.js";
window.addEventListener("load", getData)

function getData() {
    // Our list of completions (can be static, since the editor
    /// will do filtering based on context).
    // const completions = [
    //     {label: "whenGreenFlagClicked", type: "function"},
    //     {label: "ask", type: "function"},
    //     {label: "sayForSecs", type: "function"},
    //     {label: "glideSecsTo", type: "function"},
    //     {label: "switchCostume", type: "function"},
    // ]
    const completions = window.codeCompletions
    if (!completions) {
        console.log("trying to fetch data again...")
        setTimeout(getData, 20)
        return
    }
    let observerNotice = true

    function addBlock() {
        let selected = document.querySelector(".cm-tooltip-autocomplete.cm-tooltip li[aria-selected]")
        if (selected) {
            document.querySelector(".cm-completionInfo").innerHTML =  /* "<span>" + selected.innerText + "</span> *//* "<img src='" + blockImages[selected.innerText.toLowerCase()] + "'>" */`<pre class="blocks">${blockImages[selected.innerText.toLowerCase()]}</pre>`
            scratchblocks.renderMatching('pre.blocks', {
                style: 'scratch3',
                scale: 0.7,
            });
        }
    }

    function handleTooltip() {
        addBlock()

        let mutationObserver = new MutationObserver(function(e) {
            if (!observerNotice) {
                return
            }
            try {
                if (e.length == 1) {
                    if (e[0].type == "childList" && e[0].removedNodes.length == 1) {
                        // if (e[0].target.toString().startsWith("div.cm-tooltip-autocomplete.cm-tooltip")) {
                            // console.log("should remove")
                            mutationObserver.disconnect()
                            return
                        // }
                    }
                }
                // console.log(e)
            } catch {}

            // console.log("changes")
            observerNotice = false
            addBlock()
            setTimeout(function() {observerNotice = true}, 15)
            // observerNotice = true;
        });

        // have the observer observe for changes in children
        try {
            mutationObserver.observe(document.querySelector(".cm-tooltip-autocomplete.cm-tooltip"), {childList: true, subtree: true, attributes: true});
        } catch {}
    }

    function stringCheck(pos) {
        if (codemirror.state.doc.toString()[pos] == '"') {
            return false
        }
        let i = pos
        while (true) {
            if (i < 1) {
                console.log("oops")
                return false
            }
            if (codemirror.state.doc.toString()[i] == '"') {
                return false
            }
            if (codemirror.state.doc.toString()[i] == '(' || codemirror.state.doc.toString()[i] == " ") {
                return true
            }
            i -= 1
        }
    }

    function myCompletions(context) {
        let before = context.matchBefore(/\w+/)
        // If completion wasn't explicitly started and there
        // is no word before the cursor, don't open completions.
        if (!context.explicit && !before) return null
        // if (!stringCheck(context.pos)) {
        //     return null
        // }
        // alert("autocompleting...")
        setTimeout(handleTooltip, 100)
        return {
            from: before ? before.from : context.pos,
            options: completions,
            validFor: /^\w*$/
        }
    }

    // function handleNewLine() {
    //     let selection = codemirror.state.selection.ranges
    //     if (selection.length == 1) {
    //         let range = selection[0]
    //         if (range.from == range.to) {
    //             let testSlice = codemirror.state.sliceDoc(range.from - 1, range.to + 1)
    //         }
    //     }
    // }

    let view = new EditorView({
    doc: "",
    extensions: [
        basicSetup,
        autocompletion({override: [myCompletions]}),
        keymap.of([{key: "Tab", run: acceptCompletion}, indentWithTab]),
        indentUnit.of("    ")
    ],
    parent: document.getElementById("editor")
    })

    // alert("yay")
    window.codemirror = view
}