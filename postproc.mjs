#!/usr/bin/env node

import fs from "fs";
import glob from "glob";
import { JSDOM } from "jsdom";
import katex from "katex";

glob("site/**/*.html", async (er, files) => {
    for (const file of files) {
        const dom = await JSDOM.fromFile(file);
        const document = dom.window.document;

        let codes = [...document.getElementsByTagName("code")];
        for (const code of codes) {
            if (code.classList.contains("language-math")) {
                const p = document.createElement("p");
                p.innerHTML = katex.renderToString(code.textContent, { displayMode: true });
                let pre = code.parentNode;
                pre.parentNode.replaceChild(p, pre);
            } else if (/^\$.*\$$/.test(code.textContent)) {
                let span = document.createElement("span");
                span.innerHTML = katex.renderToString(code.textContent.slice(1, -1));
                code.parentNode.replaceChild(span, code);
            }
        }

        let next = document.querySelector(".nav-chapters.next");
        if (next) {
            next.remove();
        }

        let prev = document.querySelector(".nav-chapters.previous");
        if (prev) {
            prev.remove();
        }

        let searchbar = document.querySelector("input#searchbar");
        if (searchbar) {
            searchbar.placeholder = "Search this site ...";
        }

        await fs.promises.writeFile(file, dom.serialize());
    }
});
