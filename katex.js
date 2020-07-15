let css = document.createElement("link");
css.rel = "stylesheet";
css.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.11.1/katex.min.css";
css.crossOrigin = "anonymous";
css.integrity = "sha384-zB1R0rpPzHqg7Kpt0Aljp8JPLqbXI3bhnPWROx27a9N0Ll6ZP/+DiW/UqRcLbRjq";
document.head.appendChild(css);

let script = document.createElement("script");
script.defer = true;
script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.11.1/katex.min.js";
script.integrity = "sha384-y23I5Q6l+B6vatafAwxRu/0oK/79VlbSz7Q9aiSZUvyWYIYsd+qj+o24G5ZU2zJz";
script.crossOrigin = "anonymous";
document.head.appendChild(script);

script.onload = () => {
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
};
