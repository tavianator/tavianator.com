#!/usr/bin/env node

import fs from "fs";
import { Glob } from "glob";
import { JSDOM } from "jsdom";
import katex from "katex";

const files = new Glob("site/**/*.html", {});
for await (const file of files) {
    const source = await fs.promises.readFile(file, { encoding: "utf-8" });
    const dom = new JSDOM(source, {
        includeNodeLocations: true,
        runScripts: "outside-only",
    });

    const window = dom.window;
    const { document, Node } = window;

    // HTML 5 doesn't allow nested <a> tags, so detect them and fix them up
    const links = [...document.getElementsByTagName("a")];
    for (const link of links) {
        const loc = dom.nodeLocation(link);
        if (loc && !loc.endTag) {
            let end = loc.endOffset;

            let sibling = link.nextSibling;
            while (sibling) {
                const next = sibling.nextSibling;

                const sibLoc = dom.nodeLocation(sibling);
                if (sibLoc) {
                    const skipped = source.slice(end, sibLoc.startOffset);
                    if (skipped.includes("</a>")) {
                        break;
                    }

                    end = sibLoc.endOffset;

                    if (sibling.nodeType === Node.TEXT_NODE) {
                        const parsed = source.slice(sibLoc.startOffset, sibLoc.endOffset);
                        const index = parsed.indexOf("</a>");
                        if (index >= 0) {
                            const before = JSDOM.fragment(parsed.slice(0, index));
                            link.appendChild(before);

                            const after = JSDOM.fragment(parsed.slice(index + 4));
                            sibling.replaceWith(after);
                            break;
                        }
                    }
                }

                link.appendChild(sibling);
                sibling = next;
            }
        }
    }

    for (const link of links) {
        let node;

        if (link.protocol === "fa:") {
            const icon = link.href.substring(3);
            node = document.createElement("i");
            node.classList.add("fa", "fa-" + icon);
            node.ariaHidden = "true";
        } else if (link.protocol === "time:") {
            const dateTime = link.href.substring(5);
            node = document.createElement("time");
            node.dateTime = dateTime;
            node.textContent = dateTime;
        } else {
            continue;
        }

        link.replaceWith(node);
    }

    const options = {
        strict(errorCode, errorMsg, token) {
            switch (errorCode) {
                case "unknownSymbol":
                    return "ignore";
                default:
                    return "warn";
            }
        },
    };

    const codes = [...document.getElementsByTagName("code")];
    for (const code of codes) {
        if (code.classList.contains("language-math")) {
            const p = document.createElement("p");
            p.innerHTML = katex.renderToString(code.textContent, { displayMode: true, ...options });
            const pre = code.parentNode;
            pre.replaceWith(p);
        } else if (/^\$.*\$$/.test(code.textContent)) {
            const span = document.createElement("span");
            span.innerHTML = katex.renderToString(code.textContent.slice(1, -1), options);
            code.replaceWith(span);
        }
    }

    document.querySelectorAll("script[type=postproc]")
        .forEach(script => {
            window.eval(script.text);
            script.remove();
        });

    document.querySelectorAll("nav.nav-wrapper, nav.nav-wide-wrapper")
        .forEach(nav => nav.remove());

    const searchbar = document.querySelector("input#searchbar");
    searchbar.placeholder = "Search this site ...";

    await fs.promises.writeFile(file, dom.serialize());
}
