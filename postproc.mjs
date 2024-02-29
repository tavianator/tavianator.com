#!/usr/bin/env node

import fs from "fs";
import { Glob } from "glob";
import { JSDOM } from "jsdom";
import katex from "katex";

while (true) {
    const str = await fs.promises.readFile("/dev/stdin", { encoding: "utf-8" });
    if (str.length == 0) {
        break;
    }
}

const files = new Glob("../html/**/*.html", {});
for await (const file of files) {
    const source = await fs.promises.readFile(file, { encoding: "utf-8" });
    const dom = new JSDOM(source, {
        runScripts: "outside-only",
    });

    const window = dom.window;
    const { document, Node } = window;

    const ems = [...document.getElementsByTagName("em")];
    for (const em of ems) {
        if (/^fa-/.test(em.textContent)) {
            const icon = document.createElement("i");
            icon.classList.add("fa", em.textContent);
            icon.ariaHidden = "true";
            em.replaceWith(icon);
        } else if (/^time-/.test(em.textContent)) {
            const value = em.textContent.substring(5);
            const time = document.createElement("time");
            time.dateTime = value;
            time.textContent = value;
            em.replaceWith(time);
        }
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

    const sponsor = document.createElement("a");
    sponsor.classList.add("sponsor");
    sponsor.href = "https://github.com/sponsors/tavianator";
    const sponsorIcon = document.createElement("i");
    sponsorIcon.classList.add("fa", "fa-heart-o");
    sponsorIcon.ariaHidden = "true";
    sponsor.append(sponsorIcon, " Sponsor");
    const rightButtons = document.querySelector("#menu-bar .right-buttons");
    rightButtons.prepend(sponsor);

    await fs.promises.writeFile(file, dom.serialize());
}
