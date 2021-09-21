document.addEventListener("DOMContentLoaded", () => {
    let codes = [...document.getElementsByTagName("code")];
    for (let code of codes) {
        if (code.classList.contains("language-math")) {
            let p = document.createElement("p");
            katex.render(code.textContent, p, { displayMode: true });
            let pre = code.parentNode;
            pre.parentNode.replaceChild(p, pre);
        } else if (/^\$.*\$$/.test(code.textContent)) {
            let span = document.createElement("span");
            katex.render(code.textContent.slice(1, -1), span);
            code.parentNode.replaceChild(span, code);
        }
    }
});
