#!/usr/bin/env node

import { Feed } from "feed";
import fs from "fs";
import { Glob } from "glob";
import { JSDOM, VirtualConsole } from "jsdom";
import katex from "katex";
import * as fa from '@fortawesome/fontawesome-svg-core';
import * as fab from "@fortawesome/free-brands-svg-icons";
import * as far from "@fortawesome/free-regular-svg-icons";
import * as fas from "@fortawesome/free-solid-svg-icons";

fa.library.add(...Object.values(fab).filter(o => typeof o === "object"));
fa.library.add(...Object.values(far).filter(o => typeof o === "object"));
fa.library.add(...Object.values(fas).filter(o => typeof o === "object"));

const rssIcon = fa.icon(fas.faRss);
const rssIconHtml = `<span class="fa-svg">${rssIcon.html}</span>`;

const sponsorIcon = fa.icon(fas.faHeart);
const sponsorIconHtml = `<span class="fa-svg">${sponsorIcon.html}</span>`;

while (true) {
    const str = await fs.promises.readFile("/dev/stdin", { encoding: "utf-8" });
    if (str.length == 0) {
        break;
    }
}

const feed = new Feed({
    title: "tavianator.com",
    description: "tavianator.com",
    id: "https://tavianator.com/",
    link: "https://tavianator.com/",
    image: "https://tavianator.com/favicon.png",
    favicon: "https://tavianator.com/favicon.png",
    copyright: "Copyright © 2010-2025 Tavian Barnes",
    feedLinks: {
        atom: "https://tavianator.com/feed.atom",
        json: "https://tavianator.com/feed.json",
        rss: "https://tavianator.com/feed.rss",
    },
    author: {
        name: "Tavian Barnes",
        email: "tavianator@tavianator.com",
        link: "https://tavianator.com/",
    },
});

const files = new Glob("../html/**/*.html", {});
for await (const file of files) {
    if (file.endsWith("toc.html")) {
        continue;
    }

    const source = await fs.promises.readFile(file, { encoding: "utf-8" });

    // JSDOM doesn't support e.g. nested CSS blocks, so suppress errors
    const virtualConsole = new VirtualConsole();
    virtualConsole.forwardTo(console, { omitJSDOMErrors: true });

    const dom = new JSDOM(source, {
        runScripts: "outside-only",
        virtualConsole,
    });

    const window = dom.window;
    const { document, Node } = window;

    const ems = [...document.getElementsByTagName("em")];
    for (const em of ems) {
        const text = em.textContent;
        if (/^fa-/.test(text)) {
            const icon = fa.icon(fa.parse.icon(text));
            if (icon) {
                const span = document.createElement("span");
                span.classList.add("fa-svg");
                span.innerHTML = icon.html;
                em.replaceWith(span);
            } else {
                const i = document.createElement("i");
                i.className = text;
                i.ariaHidden = "true";
                em.replaceWith(i);
            }
        } else if (/^time-/.test(text)) {
            const value = text.substring(5);
            const time = document.createElement("time");
            time.dateTime = value;
            time.textContent = value;
            em.replaceWith(time);
        }
    }

    document.querySelectorAll(".content .infobar > p")
        .forEach(p => p.replaceWith(...p.childNodes));

    document.querySelectorAll(".content .infobar > i")
        .forEach(i => {
            const nodes = [i.cloneNode(true)];
            for (let j = i.nextSibling; j && j.tagName != "I" && j.tagName != "A"; j = j.nextSibling) {
                nodes.push(j);
            }
            nodes.slice(1).forEach(j => j.remove());
            const span = document.createElement("span");
            span.append(...nodes);
            i.replaceWith(span);
        });

    const katexOptions = {
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
            p.innerHTML = katex.renderToString(code.textContent, { displayMode: true, ...katexOptions });
            const pre = code.parentNode;
            pre.replaceWith(p);
        } else if (/^\$.*\$$/.test(code.textContent)) {
            const span = document.createElement("span");
            span.innerHTML = katex.renderToString(code.textContent.slice(1, -1), katexOptions);
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

    const searchbar = document.querySelector("input#mdbook-searchbar");
    searchbar.placeholder = "Search this site ...";

    const path = file.substring(8);
    if (/^\d{4}\//.test(path)) {
        const infobar = document.querySelector(".infobar");
        const url = "https://tavianator.com/" + path;
        const date = new Date(infobar.querySelector("time").dateTime);
        feed.addItem({
            title: document.title,
            id: url,
            link: url,
            date,
            author: [
                {
                    name: "Tavian Barnes",
                    email: "tavianator@tavianator.com",
                    link: "https://tavianator.com/",
                },
            ],
        });
    }

    const infobar = document.querySelector(".infobar");
    if (infobar) {
        // Add the `next` class for "Part 2 (>)" links
        const last = infobar.lastElementChild;
        if (last && last.lastChild.nodeType !== Node.TEXT_NODE) {
            last.classList.add("next");
        }
    }

    const rightButtons = document.querySelector("#mdbook-menu-bar .right-buttons");

    // Remove some whitespace from the GitHub link that adds undesirable padding
    function removeTextNodes(node) {
        for (const child of [...node.childNodes]) {
            if (child.nodeType === Node.TEXT_NODE) {
                child.remove();
            }
        }
    }
    removeTextNodes(rightButtons);
    removeTextNodes(rightButtons.lastChild);

    const feedButton = document.createElement("a");
    feedButton.classList.add("feed-link");
    feedButton.href = "/feed.atom";
    feedButton.title = "Atom feed";
    feedButton.innerHTML = rssIconHtml;
    rightButtons.prepend(feedButton);

    const sponsorButton = document.createElement("a");
    sponsorButton.classList.add("sponsor");
    sponsorButton.href = "https://github.com/sponsors/tavianator";
    sponsorButton.title = "Sponsor";
    sponsorButton.innerHTML = sponsorIconHtml;
    rightButtons.prepend(sponsorButton);

    await fs.promises.writeFile(file, dom.serialize());
}

await fs.promises.writeFile("../html/feed.atom", feed.atom1());
await fs.promises.writeFile("../html/feed.json", feed.json1());
await fs.promises.writeFile("../html/feed.rss", feed.rss2());
