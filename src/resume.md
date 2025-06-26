<style>
@media only print {
    #mdbook-menu-bar, #mdbook-menu-bar-hover-placeholder, #mdbook-sidebar {
        display: none;
    }
    #mdbook-sidebar-toggle-anchor:checked ~ .page-wrapper {
        transform: none;
    }
    .page {
        margin: 0;
    }
    .content main a:link {
        text-decoration: none;
    }
    .content {
        font-size: smaller;
    }
    @page {
        margin: 0.5in;
    }
}
</style>


# Tavian Barnes

<style>
#bio {
    display: flex;
    flex-direction: row-reverse;
    gap: 3em;
    margin-bottom: 1em;
    p {
        flex: 1;
        margin: 0;
        align-self: center;
    }
    @media (width < 540px) {
        display: block;
        p {
            margin: 1em 0 1em 0;
        }
    }
}
#contact {
    align-self: start;
    display: grid;
    grid-template-columns: min-content 1fr;
    place-items: baseline start;
    text-align: left;
    column-gap: 5px;
    p {
        display: contents;
    }
    .fa {
        min-width: 16px;
        text-align: center;
    }
    ul {
        display: flex;
        flex-wrap: wrap;
        list-style-type: none;
        align-content: baseline;
        margin: 0;
        padding: 0;
        li:not(:last-child)::after {
            content: '•';
            padding: 0 5px;
        }
    }
}
</style>
<div id="bio">
<div id="contact">

*fa-solid fa-envelope* <tavianator@tavianator.com>
*fa-solid fa-link* [tavianator.com](https://tavianator.com)
*fa-brands fa-linkedin* [linkedin.com/in/tavianator](https://www.linkedin.com/in/tavianator)
*fa-brands fa-github* [github.com/tavianator](https://github.com/tavianator/)
*fa-solid fa-earth-americas*

- Kitchener&ndash;Waterloo

</div>

Software developer interested in low-level, high-performance software across many domains, including operating systems, computer graphics, numerical computation, and machine learning/artificial intelligence.

</div>

<style>
:root {
    --pad: 20px;
}
.content h2 {
    margin-top: 0.5em;
}
.tl {
    display: grid;
}
.tli {
    padding-left: var(--pad);
    border-bottom: 1px dashed var(--icons);
    border-left: 2px solid var(--fg);
    break-inside: avoid;
}
.tli:not(:first-of-type) {
    padding-top: 1em;
}
.tli:last-child {
    margin-bottom: 1em;
    @media only print {
        margin-bottom: 0;
    }
}
.tli p {
    margin-top: 0;
    font-size: smaller;
}
.tli .tlh p {
    font-size: inherit;
    text-align: left;
}
.tli time {
    position: relative;
}
.tli time svg {
    position: absolute;
    top: 0;
    width: 16px;
    height: 100%;
    z-index: 1;
    overflow: visible;
    left: calc(-1px - var(--pad));
    line {
        stroke: var(--fg);
        stroke-width: 2px;
        stroke-linecap: round;
    }
    circle {
        stroke: var(--fg);
        stroke-width: 2px;
        fill: var(--bg);
    }
}
#skills {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
        "educ  prof"
        "phd   skills"
        "bmath langs";
    grid-auto-flow: column;
    column-gap: calc(2 * var(--pad));
    .col {
        display: contents;
        &:last-child {
            text-align: right;
        }
    }
    ul {
        display: flex;
        flex-wrap: wrap;
        list-style-type: none;
        align-content: baseline;
        justify-content: end;
        padding-left: calc(var(--pad) - 16px);
        &:first-of-type {
            margin-top: 0;
        }
        li::before {
            content: '•';
            padding: 0 5px;
        }
    }
    @media (width < 540px) {
        grid-template-columns: 1fr;
        grid-template-areas:
            "educ"
            "phd"
            "bmath"
            "prof"
            "skills"
            "langs";
        .col:last-child {
            text-align: left;
        }
        ul {
            justify-content: start;
        }
    }
    @media only print {
        ul {
            padding-left: 4em;
        }
    }
}
</style>
<script type="postproc">
// Draw lines from the <time> tags to the timeline
for (const time of document.querySelectorAll(".tl time")) {
    var svg = document.createElement("svg");
    var line = document.createElement("line");
    line.setAttribute("x1", "0%");
    line.setAttribute("y1", "50%");
    line.setAttribute("x2", "100%");
    line.setAttribute("y2", "50%");
    svg.append(line);
    var circle = document.createElement("circle");
    circle.setAttribute("cx", "0%");
    circle.setAttribute("cy", "50%");
    circle.setAttribute("r", "4");
    svg.append(circle);
    time.append(svg);
}
</script>
<div id="skills" class="tl">

<div class="col">

## Education

<div class="tli">
<div class="tlh">

**PhD, Computer Science**  
[University of Waterloo](https://uwaterloo.ca/)  
<time>*2020&ndash;Present*</time>

</div>
</div>

<div class="tli">
<div class="tlh">

**BMath, Computer Science**  
<small>**Combinatorics & Optimization Minor**</small>  
[University of Waterloo](https://uwaterloo.ca/)  
<time>*2009&ndash;2014*</time>

</div>
</div>
</div>

<div class="col">

## Proficiencies

- Performance analysis
- Optimization
- Systems
- Kernels
- Compilers
- Concurrency
- Machine learning

<!-- break -->

- C
- C++
- Rust
- Python
- Ruby
- Java
- C&sharp;
- JavaScript
- TypeScript
- Haskell
- Agda
- x86-64, ARM assembly
- Bash

</div>
</div>


## Work Experience

<style>
.tl {
    --pad: 20px;
}
.tli .logo {
    width: 60px;
    height: 45px;
    float: right;
    margin-left: var(--pad);
    mask: center/contain no-repeat luminance;
    background: currentColor;
    --shop-logo: url(./resume/shop.svg);
    --uw-logo: url(./resume/uw.png);
    --msft-logo: url(./resume/msft.svg);
    --maluuba-logo: url(./resume/maluuba.png);
    --uofc-logo: url(./resume/uofc.webp);
}
html.light, html.rust {
    .tli .logo {
        --shop-logo: url(./resume/shop-light.svg);
        --uw-logo: url(./resume/uw-light.png);
        --msft-logo: url(./resume/msft-light.svg);
        --maluuba-logo: url(./resume/maluuba-light.png);
        --uofc-logo: url(./resume/uofc-light.webp);
    }
}
#shop-logo {
    mask-image: var(--shop-logo);
}
#uw-logo {
    mask-image: var(--uw-logo);
}
#msft-logo {
    mask-image: var(--msft-logo);
}
#maluuba-logo {
    mask-image: var(--maluuba-logo);
}
#uofc-logo {
    mask-image: var(--uofc-logo);
}
</style>
<div class="tl">
<div class="tli">

<div class="logo" id="shop-logo"></div>

<div class="tlh">

**Staff Engineer**  
[Shopify](https://www.shopify.com/)  
<time>*2025&ndash;Present*</time>

</div>

Core contributor to Shopify's AI agent platform that powers [Sidekick](https://www.shopify.com/ca/magic) (Shopify's AI assistant for merchants) and other agentic experiences at Shopify.
I'm focused on improving the performance, quality, and capabilities of the platform, working at every layer from the language runtime itself to the web server, load balancer, and fine-tuned models, as well as collaborating directly with major LLM vendors.

</div>
<div class="tli">

<div class="logo" id="uw-logo"></div>

<div class="tlh">

**Sessional Lecturer**  
[University of Waterloo](https://uwaterloo.ca/)  
<time>*2024*</time>

</div>

Taught a section of [CS 350 - Operating Systems](https://student.cs.uwaterloo.ca/~cs350/F24/), a required third-year Computer Science course, for the Fall 2024 term.
Devised lecture materials, assignments, and examinations in collaboration with the instructional team.

</div>
<div class="tli">

<div class="logo" id="msft-logo"></div>

<div class="tlh">

**Senior Software Development Engineer**  
[Microsoft Research](https://www.microsoft.com/en-us/research/lab/microsoft-research-montreal/)  
<time>*2017&ndash;2019*</time>

</div>

Developed tools and infrastructure for our lab's research projects, and helped integrate our research into products.
Built the initial prototype of [SmartFind](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/microsoft-search-search-your-document-like-you-search-the-web/4210662), which uses deep learning to improve the recall and question answering capabilities of the Microsoft Word search box.
Contributed to the [Hybrid Reward Architecture](https://www.microsoft.com/en-us/research/project/hybrid-reward-architecture/) paper&mdash;the first AI technique to beat the Atari 2600 game *Ms. Pac-Man*, and [TextWorld](https://www.microsoft.com/en-us/research/project/textworld/)&mdash;an RL environment for text-based games.

</div>
<div class="tli">

<div class="logo" id="maluuba-logo"></div>

<div class="tlh">

**Senior Software Engineering Developer**  
[Maluuba](https://en.wikipedia.org/wiki/Maluuba)  
<time>*2012&ndash;2017*</time>

</div>

Led the development of our virtual personal assistant framework, using state-of-the-art natural language processing techniques.
This product was deployed to millions of customers through partnerships with leading smartphone and smart TV makers.
In 2017, Maluuba was acquired by Microsoft, and became a new Microsoft Research lab specializing in deep learning, language understanding, dialogue systems, and reinforcement learning.

</div>
<div class="tli">

<div class="logo" id="uofc-logo"></div>

<div class="tlh">

**Web Developer**  
[University of Calgary](https://ucalgary.ca/)  
<time>*2008&ndash;2011*</time>

</div>

Worked on the Drupal front-end of UNITIS, an information system that manages people, groups, and assets for departments and faculties at the university.
UNITIS powered the campus-wide staff directory, as well as many department webpages including the Department of Mathematics and Statistics.

</div>
</div>


## Publications

<div class="tl">
<div class="tli">

[**The Aurora Single Level Store Operating System**](https://dl.acm.org/doi/10.1145/3477132.3483563)  
Emil Tsalapatis, Ryan Hancock, Tavian Barnes, Ali José Mashtizadeh  
<time>*2021*</time>.
In *Proceedings of the ACM SIGOPS 28th Symposium on Operating Systems Principles*.
Association for Computing Machinery, New York, NY, USA, 788–803.

</div>
<div class="tli">

[**TextWorld: A Learning Environment for Text-based Games**](https://arxiv.org/abs/1806.11532)  
Marc-Alexandre Côté, Ákos Kádár, Xingdi Yuan, Ben Kybartas, Tavian Barnes, Emery Fine, Jasmine Moore, Ruo Yu Tao, Matthew Hausknecht, Layla El Asri, Mahmoud Adada, Wendy Tay, Adam Trischler  
<time>*2018*</time>.
In *Computer Games, 7th Workshop, CGW 2018, Held in Conjunction with the 27th International Conference on Artificial Intelligence, IJCAI 2018, Stockholm, Sweden, July 13, 2018, Revised Selected Papers*.
Springer Nature Switzerland, Cham, Switzerland, 41-75.

</div>
<div class="tli">

[**Hybrid Reward Architecture for Reinforcement Learning**](https://dl.acm.org/doi/10.5555/3295222.3295291)  
Harm van Seijen, Mehdi Fatemi, Joshua Romoff, Romain Laroche, Tavian Barnes, Jeffrey Tsang  
<time>*2017*</time>.
In *Proceedings of the 31st International Conference on Neural Information Processing Systems*.
Curran Associates Inc., Red Hook, NY, USA, 5398–5408.

</div>
</div>


## Patents

<div class="tl">
<div class="tli">

[**Method and system for classifying queries**](https://patents.google.com/patent/US10467259B2/) (US10467259B2)  
Kaheer Suleman, Jing He, Tavian Barnes  
<time>*2015*</time>

</div>
</div>
