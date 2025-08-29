#!/usr/bin/env node

import { Feed } from "feed";
import fs from "fs";
import { Glob } from "glob";
import { JSDOM, VirtualConsole } from "jsdom";
import katex from "katex";

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
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });

    const dom = new JSDOM(source, {
        runScripts: "outside-only",
        virtualConsole,
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

    document.querySelectorAll(".content .infobar > a > i.fa-chevron-circle-right")
        .forEach(i => i.parentNode.classList.add("next"));

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

    const searchbar = document.querySelector("input#searchbar");
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

    const rightButtons = document.querySelector("#menu-bar .right-buttons");

    const feedButton = document.createElement("a");
    feedButton.classList.add("feed-link");
    feedButton.href = "/feed.atom";
    feedButton.title = "Atom feed";
    feedButton.onclick = "foo";
    const feedIcon = document.createElement("i");
    feedIcon.classList.add("fa", "fa-rss");
    feedIcon.ariaHidden = "true";
    feedButton.append(feedIcon);
    rightButtons.prepend(feedButton);

    const sponsorButton = document.createElement("a");
    sponsorButton.classList.add("sponsor");
    sponsorButton.href = "https://github.com/sponsors/tavianator";
    sponsorButton.title = "Sponsor";
    const sponsorIcon = document.createElement("i");
    sponsorIcon.classList.add("fa", "fa-heart");
    sponsorIcon.ariaHidden = "true";
    sponsorButton.append(sponsorIcon);
    rightButtons.prepend(sponsorButton);

    await fs.promises.writeFile(file, dom.serialize());
}

await fs.promises.writeFile("../html/feed.atom", feed.atom1());
await fs.promises.writeFile("../html/feed.json", feed.json1());
await fs.promises.writeFile("../html/feed.rss", feed.rss2());
